// supabase/functions/generate-image/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    console.log("--- [1/8] Invoking generate-image function for Azure DALL-E 3 ---");

    const azureApiKey = Deno.env.get('AZURE_AI_KEY');
    const azureEndpoint = Deno.env.get('AZURE_AI_ENDPOINT');

    if (!azureApiKey || !azureEndpoint) {
      throw new Error("Critical: Azure AI secrets (AZURE_AI_KEY or AZURE_AI_ENDPOINT) are not set.");
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { templateId, imageUrls } = await req.json();
    if (!templateId || !imageUrls || !imageUrls[0]) {
      throw new Error('Invalid request: Missing templateId or imageUrls.');
    }
    console.log(`--- [2/8] Received job for templateId: ${templateId} ---`);

    const { data: templateData } = await supabaseClient
      .from('templates').select('prompt_template').eq('id', templateId).single();
    if (!templateData) throw new Error(`Template with ID ${templateId} not found.`);
    console.log("--- [3/8] Successfully fetched template details ---");
    
    // DALL-E 3 is powerful. We can guide it by including the image URL in the prompt.
    const enhancedPrompt = `${templateData.prompt_template}. The main subject should closely resemble the person in this image: ${imageUrls[0]}`;

    // The API endpoint for starting the DALL-E 3 generation job
    const apiUrl = `${azureEndpoint}openai/images/generations:submit?api-version=2024-03-01-preview`;
    
    console.log("--- [4/8] Starting generation job on Azure... ---");
    const startResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "api-key": azureApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
            "model": "dall-e-3", // Using the DALL-E 3 model
            "prompt": enhancedPrompt,
            "n": 1,
            "size": "1024x1024",
            "response_format": "b64_json" // Ask for the image as a Base64 string
        })
    });
    
    if (startResponse.status !== 202) { // 202 status means the job was accepted
        const errorBody = await startResponse.json();
        console.error("Azure API failed to start the job:", errorBody);
        throw new Error(errorBody.error.message || "Failed to start image generation job on Azure.");
    }
    console.log("--- [5/8] Job accepted by Azure. Now polling for result... ---");

    // Get the URL to check the status of the job
    const operationLocation = startResponse.headers.get('operation-location');
    if (!operationLocation) {
      throw new Error("Azure API did not return an operation-location header to check for results.");
    }

    let result;
    let attempts = 0;
    const maxAttempts = 18; // Poll for a max of 90 seconds (18 * 5 seconds)

    while (attempts < maxAttempts) {
        // Wait for 5 seconds before checking the status again
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`--- [6/8] Polling attempt #${attempts + 1}... ---`);

        const resultResponse = await fetch(operationLocation, {
            headers: { "api-key": azureApiKey }
        });

        if (!resultResponse.ok) {
          throw new Error(`Polling for result failed with status: ${resultResponse.status}`);
        }

        const statusResult = await resultResponse.json();

        if (statusResult.status === 'succeeded') {
            result = statusResult.result;
            console.log("--- [7/8] Generation succeeded! ---");
            break; // Exit the loop on success
        }
        if (statusResult.status === 'failed') {
            console.error("Azure job failed:", statusResult.error);
            throw new Error(`Image generation failed on Azure: ${statusResult.error.message}`);
        }
        
        attempts++;
    }

    if (!result) {
      throw new Error("Image generation timed out after 90 seconds. The server might be busy. Please try again later.");
    }

    const generatedImageBase64 = result.data[0].b64_json;
    
    if (!generatedImageBase64) {
      console.error("Malformed success response from Azure AI:", result);
      throw new Error("API returned a success status, but the image data was not found.");
    }
    
    console.log("--- [8/8] Successfully retrieved image. Sending response to client. ---");
    return new Response(JSON.stringify({ image: generatedImageBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error("!!! An error occurred in the function !!!");
    console.error("Error Message:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
