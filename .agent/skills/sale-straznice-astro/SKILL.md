---
name: sale-straznice-astro
description: Specific patterns and conventions for the Sale Straznice Astro project.
---

# Sale Straznice Astro Skill

This skill documents the specific architecture, coding standards, and patterns used in the Sale Straznice project.

## 🚀 Core Stack
- **Astro 6**: Component-based framework for content-driven sites.
- **Tailwind CSS 4**: CSS-first styling with `@theme` block in `global.css`.
- **GSAP**: Animation library for high-performance interactive elements.
- **Vitest**: Testing framework for unit and component tests.

## ⚠️ CRITICAL RULE: Content Preservation
**NEVER change text content, translations, or copy unless explicitly requested by the user.** 
When refactoring or adding features, keep all strings in `locales/*.json` and component templates exactly as they are. Only modify code, structure, and styling unless the task is specifically about content editing.

## 🌍 i18n Pattern
The project uses a custom JSON-based i18n system located in `src/i18n/`.

### Structure
- `src/i18n/locales/cs.json`: Czech translations (Default).
- `src/i18n/locales/en.json`: English translations.
- `src/i18n/ui.ts`: Configuration of languages and exported `ui` object.
- `src/i18n/utils.ts`: Utility functions like `getLangFromUrl` and `useTranslations`.

### Usage in Components
```astro
---
import { getLangFromUrl, useTranslations } from '../i18n/utils';

const lang = getLangFromUrl(Astro.url);
const t = useTranslations(lang);
---
<h2>{t('nav.home')}</h2>
```

## 🎨 Styling with Tailwind 4
Tailwind 4 is configured in `src/styles/global.css` using the `@theme` block.

### Design Tokens
Use the predefined CSS variables from `@theme`:
- Colors: `primary`, `secondary`, `tertiary`, `surface`, `on-surface`.
- Typography: `font-sans`, `font-serif`, `font-body`.
- Spacing: `gutter`, `element-gap`, `section-padding`.

### Example
```html
<section class="bg-surface p-section-padding text-on-surface">
  <h1 class="text-primary font-serif">Hello</h1>
</section>
```

## 🎭 Animations (GSAP)
Interactive components (like `AnimatedGarden.astro`) use GSAP for animations.

### Best Practices
- Use `gsap.context()` for proper cleanup if using in frameworks (not strictly needed for vanilla Astro but good practice).
- Target elements via classes or `data-` attributes.
- Keep animation logic within `<script>` tags in `.astro` files.

## 🏗️ Component Architecture
- **Layouts**: Use `src/layouts/Layout.astro` for all pages. It handles SEO, fonts, and the base structure.
- **Components**: Reusable UI blocks in `src/components/`.
- **Pages**: Locale-based routing (`src/pages/index.astro` for CS, `src/pages/en/index.astro` for EN).

## 🧪 Testing
- Run tests with `npm test`.
- Add new tests in `src/test/`.
