# 🎨 Proompt

**Proompt** is a cross-platform mobile application designed to simplify the creation of trendy, AI-generated images. It abstracts the complexity of prompt engineering by offering a curated gallery of pre-defined styles ("templates"). Users select a template, upload their photo(s), and receive a high-quality, stylized image ready for social media.

This project is built with **Expo (React Native)** for the frontend and utilizes a **Supabase** backend for serverless functions, database, and storage.

---

## ✨ Features (Version 1.0)

-   **Dynamic Template Gallery:** A scrollable home screen that fetches the latest viral AI photo style templates directly from the backend, allowing for content updates without a new app release.
-   **Simplified User Flow:** An intuitive `Select -> Upload -> Generate` flow that requires zero technical knowledge from the user.
-   **Secure Backend Logic:** All interactions with the third-party AI image generation API are handled securely within a Supabase Edge Function, ensuring no API keys are exposed on the client-side.
-   **High-Quality Output:** The backend is engineered to call powerful AI models to produce aesthetically pleasing, high-resolution images.
-   **Easy Export:** Users can save their creations to their device's photo library with a single tap.

---

## 🚀 Tech Stack

-   **Frontend:** [React Native](https://reactnative.dev/) (managed by [Expo](https://expo.dev/))
-   **Backend:** [Supabase](https://supabase.com/)
    -   **Database:** Supabase Postgres
    -   **Storage:** Supabase Storage (for user image uploads)
    -   **Serverless Functions:** Supabase Edge Functions (Deno)
-   **Navigation:** [React Navigation](https://reactnavigation.org/)
-   **Primary Language:** JavaScript / TypeScript

---

## 🔧 **IMPORTANT: AI Image Generation API**

The core functionality of this application depends on a third-party Image-to-Image AI service. The backend is architected to be flexible, allowing different services to be integrated by modifying a single serverless function.

**As of the current version, the specific AI service has not been finalized.** The `supabase/functions/generate-image/index.ts` function must be configured to use one of the following recommended services.

### Recommended API Providers:

1.  #### OpenRouter (Google Gemini) - *Recommended for Quality & Free Start*
    -   **Service:** [OpenRouter.ai](https://openrouter.ai/)
    -   **Model:** `google/gemini-2.5-flash-image-preview`
    -   **Pros:** Access to Google's state-of-the-art model, reliable, provides free starting credits. The architecture is simple (synchronous API call).
    -   **Setup:**
        1.  Get an API key from OpenRouter.
        2.  Set it as a secret in your Supabase project with the name `OPENROUTER_API_KEY`.
        3.  Implement the `fetch` call to the OpenRouter `/chat/completions` endpoint inside the `generate-image` function.

2.  #### Replicate - *Recommended for Reliability & Specialization*
    -   **Service:** [Replicate.com](https://replicate.com/)
    -   **Model:** `b19b274242780e8540c4b827b72350af07a7f43b61875143a595167e41cf43d1` (for `ip-adapter-faceid-plus-v2-sdxl`)
    -   **Pros:** Extremely reliable, professional-grade, huge library of specialized models, provides free starting credits.
    -   **Setup:**
        1.  Get an API key from Replicate.
        2.  Set it as a secret named `REPLICATE_API_TOKEN`.
        3.  Requires an asynchronous (webhook-based) architecture with two functions: `start-generation` and `handle-replicate-webhook`.

3.  #### Vertex AI (Google Cloud) - *Professional/Student Option*
    -   **Service:** [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai)
    -   **Model:** `imagegeneration@006` (Imagen 2)
    -   **Pros:** Most powerful and direct access to Google's models. Generous free credits available, especially for students via the **GitHub Student Developer Pack**.
    -   **Setup:**
        1.  Requires a Google Cloud project with billing enabled.
        2.  Create a Service Account and download the JSON key.
        3.  Store the JSON key and Project ID as secrets in Supabase.
        4.  The `generate-image` function needs to include logic to authenticate and get a temporary access token before calling the Vertex AI API.

---

## ⚙️ Setup & Installation

### Prerequisites

-   [Node.js](https://nodejs.org/) (LTS version)
-   [Supabase CLI](https://supabase.com/docs/guides/cli)
-   An active Supabase project.

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kashyapvadgama/Proompt.git
    cd Proompt
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Supabase:**
    -   Link your local project to your remote Supabase project:
        ```bash
        supabase link --project-ref [YOUR_PROJECT_REF]
        ```
    -   Create a `.env` file in the root of the project and add your Supabase URL and Anon Key. **Do not commit this file.**
        ```env
        EXPO_PUBLIC_SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
        EXPO_PUBLIC_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
        ```

4.  **Database Schema:**
    -   Run the SQL scripts located in `supabase/migrations/` to set up the `templates` table. You can apply migrations using:
        ```bash
        supabase db push
        ```

5.  **Set Up AI API Secrets:**
    -   Choose one of the recommended AI providers from the section above.
    -   Get the necessary API key/credentials.
    -   Set them as secrets in your Supabase project using the Supabase CLI or Dashboard. For example:
        ```bash
        supabase secrets set OPENROUTER_API_KEY="sk-or-..."
        ```

6.  **Deploy the Edge Function:**
    -   Ensure your `supabase/functions/generate-image/index.ts` is configured for your chosen API provider.
    -   Deploy the function:
        ```bash
        supabase functions deploy generate-image
        ```

7.  **Run the application:**
    ```bash
    npx expo start
    ```
    Scan the QR code with the Expo Go app on your mobile device.

## 🗃️ Supabase Schema

### `templates` table
This table stores the information for each available image generation style.

| Column          | Type      | Description                                                    |
| --------------- | --------- | -------------------------------------------------------------- |
| `id`            | `bigint`  | **Primary Key**                                                |
| `name`          | `text`    | The name of the template (e.g., "3D Figurine").                |
| `description`   | `text`    | A short description of the style.                              |
| `prompt_template` | `text`    | The detailed text prompt sent to the AI model.                 |
| `is_active`     | `boolean` | Controls whether the template appears in the app.              |
| `cover_image_url` | `text`    | URL for the template's cover image.                            |
| `required_photos` | `integer` | The number of photos the user needs to upload for this template. |

---
*This README is a living document. As the project evolves, please update it with any changes to the architecture, setup process, or tech stack.*
