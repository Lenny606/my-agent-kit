# i18n Guide for Sale Straznice

## Adding a New Translation Key

1. **Update Locales**: Add the key to both `src/i18n/locales/cs.json` and `src/i18n/locales/en.json`.
   
   ```json
   // cs.json
   {
     "new.key": "Nová hodnota"
   }
   
   // en.json
   {
     "new.key": "New value"
   }
   ```

2. **Use in Component**:
   ```astro
   ---
   const t = useTranslations(lang);
   ---
   <p>{t('new.key')}</p>
   ```

## Adding a New Language

1. **Create Locale File**: Create `src/i18n/locales/[lang].json`.
2. **Update `ui.ts`**:
   ```typescript
   import [lang] from './locales/[lang].json';

   export const languages = {
     cs: 'Čeština',
     en: 'English',
     [lang]: '[Language Name]',
   };

   export const ui = {
     cs,
     en,
     [lang],
   } as const;
   ```
3. **Update `astro.config.mjs`**:
   Add the new locale to the `i18n.locales` array.
4. **Create Pages**: Create a new directory in `src/pages/[lang]/` with the corresponding pages.
