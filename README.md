# Text Generator

## Run locally

1. Install dependencies with `npm install`.
2. Set `GOOGLE_API_KEY` in `.env` to your Google AI Studio API key. Keep this key in `.env`; never put it in React code or commit it.
3. Run `npm start`. This starts the React app and its local API server together.

Open the frontend URL printed in the terminal (usually `http://localhost:3000`). The frontend calls the local API at `http://localhost:3001`.

The default model is `gemini-3.8-flash`. To use another model available to Google AI Studio, set `GOOGLE_MODEL` in `.env`.

Without a valid API key, the app displays a setup error instead of waiting without a response. Production deployments must also host the API server and route `/api/generate` to it; the Create React App proxy only applies during local development.

If generation fails because of a Google AI Studio quota or rate limit, check the selected model's limits and billing in AI Studio, or try again after the limit resets.

## Other commands

- `npm test -- --watchAll=false` runs the tests.
- `npm run build` creates the production frontend build.
