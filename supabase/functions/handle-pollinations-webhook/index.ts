import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("--- [1/4] Webhook received from Pollinations ---");

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) throw new Error("Critical: SUPABASE_SERVICE_ROLE_KEY is not set.");
    
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);

    const url = new URL(req.url);
    const generationId = url.searchParams.get('id');
    if (!generationId) {
      throw new Error("Webhook was called without a generationId in the URL.");
    }
    console.log(`--- [2/4] Processing webhook for generationId: ${generationId} ---`);

    let updatePayload;
    const contentType = req.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
        const body = await req.json();
        console.error("--- Webhook received an error payload from Pollinations ---", body);
        updatePayload = {
            status: 'failed',
            error_message: body.error || "Pollinations returned a JSON error.",
        };
    } else {
        const finalImageUrl = await req.text();
        console.log(`--- [3/4] Received success payload (image URL): ${finalImageUrl} ---`);
        
        if (finalImageUrl && finalImageUrl.startsWith('http')) {
            updatePayload = {
                status: 'succeeded',
                output_image_url: finalImageUrl,
            };
        } else {
            console.error("--- Webhook received an invalid text payload ---", finalImageUrl);
            updatePayload = {
                status: 'failed',
                error_message: 'Pollinations webhook returned invalid or empty data.',
            };
        }
    }

    const { error } = await supabaseAdmin
      .from('generations')
      .update(updatePayload)
      .eq('id', generationId);

    if (error) {
        console.error("--- Database update failed ---", error);
        throw new Error(`Failed to update generations table: ${error.message}`);
    }
    
    console.log(`--- [4/4] Successfully updated database for generationId: ${generationId} ---`);

    return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    });

  } catch (err) {
    console.error("!!! An error occurred in handle-pollinations-webhook function !!!");
    console.error("Error Message:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})