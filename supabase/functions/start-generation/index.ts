import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log("--- [1/6] Invoking start-generation for Pollinations ---");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { templateId, imageUrls } = await req.json()
    if (!templateId || !imageUrls || !imageUrls[0]) {
      throw new Error('Invalid request: Missing templateId or imageUrls.')
    }
    console.log(`--- [2/6] Received job for templateId: ${templateId} ---`);

    const { data: templateData, error: dbError } = await supabaseClient
      .from('templates').select('prompt_template, pollinations_model_url').eq('id', templateId).single()
    
    if (dbError) throw new Error(`Database error: ${dbError.message}`);
    if (!templateData?.pollinations_model_url) {
      throw new Error(`Template ${templateId} is missing the pollinations_model_url configuration.`);
    }
    console.log("--- [3/6] Successfully fetched template details ---");

    const { data: genRecord, error: insertError } = await supabaseClient
      .from('generations').insert({ template_id: templateId, status: 'processing' }).select('id').single()
    if (insertError) throw new Error(`Failed to create generation record: ${insertError.message}`);
    console.log(`--- [4/6] Created generation record with ID: ${genRecord.id} ---`);

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-pollinations-webhook?id=${genRecord.id}`
    
    const encodedPrompt = encodeURIComponent(templateData.prompt_template);
    const encodedImageUrl = encodeURIComponent(imageUrls[0]);
    const encodedModel = encodeURIComponent(templateData.pollinations_model_url);
    const encodedWebhookUrl = encodeURIComponent(webhookUrl);

    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?image=${encodedImageUrl}&model=${encodedModel}&webhook=${encodedWebhookUrl}`;
    
    console.log(`--- [5/6] Calling Pollinations API to start job... ---`);
    
    const response = await fetch(pollinationsUrl);
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Pollinations API returned an error on job start:", response.status, errorText);
        throw new Error(`Pollinations API failed to start the job. Status: ${response.status}`);
    }

    console.log(`--- [6/6] Job successfully submitted to Pollinations. Waiting for webhook. ---`);
    
    return new Response(JSON.stringify({ generationId: genRecord.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (err) {
    console.error("!!! An error occurred in start-generation function !!!");
    console.error("Error Message:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})