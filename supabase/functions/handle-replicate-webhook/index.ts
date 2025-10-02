import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
Deno.serve(async (req) => {
  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)
    const url = new URL(req.url)
    const generationId = url.searchParams.get('id')
    if (!generationId) throw new Error("Missing generation ID.")
    const body = await req.json()
    const { status, output, error } = body;
    const updatePayload = {
      status: status === 'succeeded' ? 'succeeded' : 'failed',
      output_image_url: status === 'succeeded' ? output[0] : null,
      error_message: status === 'failed' ? error : null,
    }
    await supabaseAdmin.from('generations').update(updatePayload).eq('id', generationId)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})