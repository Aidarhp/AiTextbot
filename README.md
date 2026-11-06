# Text Generator

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to your OpenAI API key. Keep this key in `.env`; never put it in React code or commit it.
3. Run `npm start`. This starts the React app and its local API server together.

Open the frontend URL printed in the terminal (usually `http://localhost:3000`). The frontend calls the local API at `http://localhost:3001`.

The default model is `gpt-4o-mini`. To use another model available to your OpenAI account, set `OPENAI_MODEL` in `.env`.

Without a valid API key, the app displays a setup error instead of waiting without a response. Production deployments must also host the API server and route `/api/generate` to it; the Create React App proxy only applies during local development.

## Other commands

- `npm test -- --watchAll=false` runs the tests.
- `npm run build` creates the production frontend build.
