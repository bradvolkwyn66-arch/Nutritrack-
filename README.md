# NutriTrack

A responsive nutrition tracker built with React, TypeScript, Vite and Lucide icons.

## Features
- Daily food diary with breakfast, lunch, dinner and snacks
- Calorie, protein, carbohydrate and fat totals
- Editable daily nutrient goals
- Water-glass tracker
- Date selection to review daily logs
- Food search powered by Open Food Facts (millions of products); nutrition scales to the grams you enter
- Login screen (email + password) and an online-only gate: the app is blocked while offline
- Local browser persistence via `localStorage` (meals, water and goals), separate for each account
- Responsive desktop and mobile layouts

## Run locally
1. Install Node.js 20 or newer.
2. Extract this ZIP and open a terminal in the project directory.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL printed by Vite.

To create a production build, run `npm run build`; the output is in `dist/`.

## Accounts (important)
Accounts are stored **in this browser only**: passwords are kept as salted PBKDF2 hashes, but there is no server, so accounts and data do not sync between devices and are not a substitute for real server-side authentication. Secure login needs https (or localhost). To get real accounts and sync, add a server-side auth/database provider.

## Food database
Search uses Open Food Facts (crowd-sourced, mostly packaged products; whole foods such as fruit can be patchy). You can always enter any food manually.

## Data storage note
This version stores food entries and water intake in the browser on the current device. It does not sync data between devices or user accounts. Sample meals appear on first launch to demonstrate the dashboard.

## Live deployment
https://nutritrack-yctxu9.v2.appdeploy.ai/


## Hosting on Vercel (phone-friendly layout)
All app files sit in the repository root, plus one `api/chat.ts` function for the AI helper.
In Vercel -> Project -> Settings -> Environment Variables add:
- `OPENROUTER_API_KEY` (required for the AI helper)
- `GEMINI_API_KEY` (optional backup AI)
- `OPENROUTER_MODELS` (optional, comma-separated free model ids; free model names change often)
Then redeploy.
