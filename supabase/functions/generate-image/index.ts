import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// Helper function to get a temporary Access Token from Google
async function getAccessToken(serviceAccount: any) {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    iat: Math.floor(Date.now() / 1000),
  };
  
  // --- THIS IS THE CRITICAL FIX FOR THE CRYPTOGRAPHY ERROR ---
  // The private_key from the JSON file is a string that needs to be formatted correctly.
  const privateKeyPem = serviceAccount.private_key
    .replace(/\\n/g, '\n') // Replace literal \n with actual newlines
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, ''); // Remove all whitespace

  // Decode the Base64 formatted key to get the raw binary data (ArrayBuffer)
  const binaryKey = atob(privateKeyPem);
  const keyBuffer = new Uint8Array(binaryKey.length);
  for (let i = 0; i < binaryKey.length; i++) {
    keyBuffer[i] = binaryKey.charCodeAt(i);
  }

  const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer.buffer, // Use the correctly formatted ArrayBuffer
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"]
  );

  const jwt = await create(header, payload, privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokens = await response.json();
  if (!tokens.access_token) {
    console.error("Failed to get access token:", tokens);
    throw new Error("Failed to retrieve Google Cloud access token.");
  }
  return tokens.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const gcpServiceAccountKey = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY');
    const gcpProjectId = Deno.env.get('GCP_PROJECT_ID');
    if (!gcpServiceAccountKey || !gcpProjectId) {
      throw new Error("GCP secrets are not set.");
    }
    const serviceAccount = JSON.parse(gcpServiceAccountKey);

    const accessToken = await getAccessToken(serviceAccount);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { templateId, imageUrls } = await req.json();
    if (!templateId || !imageUrls || !imageUrls[0]) {
      throw new Error('Invalid request: Missing templateId or imageUrls.');
    }

    const { data: templateData } = await supabaseClient
      .from('templates').select('prompt_template').eq('id', templateId).single();
    if (!templateData) throw new Error(`Template with ID ${templateId} not found.`);

    const imageResponse = await fetch(imageUrls[0]);
    if (!imageResponse.ok) throw new Error(`Failed to download user image.`);
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const inputImageBase64 = encodeBase64(imageArrayBuffer);
    
    const apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/imagegeneration@006:predict`;

    const requestBody = {
      "instances": [
        {
          "prompt": templateData.prompt_template,
          "image": { "bytesBase64Encoded": inputImageBase64 }
        }
      ],
      "parameters": {
        "sampleCount": 1,
        "aspectRatio": "1:1",
        "guidanceScale": 9,
        "editConfig": { "editMode": "subject-generation" } 
      }
    };

    const vertexResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    if (!vertexResponse.ok) {
        const errorBody = await vertexResponse.json();
        console.error("Vertex AI Error:", JSON.stringify(errorBody, null, 2));
        throw new Error(errorBody.error.message || "Failed to generate image via Vertex AI.");
    }
    
    const result = await vertexResponse.json();
    const generatedImageBase64 = result.predictions[0].bytesBase64Encoded;
    
    if (!generatedImageBase64) {
        console.error("Malformed response from Vertex AI:", result);
        throw new Error("API returned a response without the expected image data.");
    }
    
    return new Response(JSON.stringify({ image: generatedImageBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error("!!! Function failed:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})