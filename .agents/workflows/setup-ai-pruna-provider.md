---
description: Sets up or updates the @umituz/react-native-ai-pruna-provider package in a React Native app.
---

# Pruna AI Provider Setup Skill

When this workflow/skill is invoked, follow these explicit instructions to configure `@umituz/react-native-ai-pruna-provider` for text-to-image and image-to-video AI generation capabilities.

## Step 1: Check and Update `package.json`
- Locate the project's `package.json`.
- Check if `@umituz/react-native-ai-pruna-provider` is installed.
  - If missing: Install with `npm install @umituz/react-native-ai-pruna-provider`.
  - If outdated: Update it to the latest version.

## Step 2: Ensure Peer Dependencies
This module requires the core AI generation content package. Verify and install if missing:
- `@umituz/react-native-ai-generation-content`

## Step 3: Check Environment Variables
- Ensure that the `PRUNA_API_KEY` environment variable is defined in the project's `.env.example` and `.env` files. If it is missing, politely prompt the user to add it.

## Step 4: Inject Provider Initialization
- Locate the app's initialization sequence (e.g., `App.tsx`, `app/_layout.tsx`, or an initialization module `src/init/index.ts`).
- Import `initializePrunaProvider` from `@umituz/react-native-ai-pruna-provider`.
- Configure the provider exactly as follows:
  ```typescript
  import { initializePrunaProvider } from '@umituz/react-native-ai-pruna-provider';

  // Inside initialization logic:
  initializePrunaProvider({
    apiKey: process.env.EXPO_PUBLIC_PRUNA_API_KEY || '',
  });
  ```

## Step 5: Summary
State what changes were made. List any downloaded packages (e.g. `@umituz/react-native-ai-generation-content`), env setups, and which file the `initializePrunaProvider` function was added to.
