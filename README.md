# Shopify Store Theme

Custom Shopify theme code for my store, based on Shopify's official **Craft** theme, managed and deployed locally via the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli).

<!-- TODO: add a link to the live store and a screenshot -->

## Stack

- Shopify Liquid, JSON templates, CSS, JS
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) for local development and deployment

## Structure

- `assets/` — CSS, JS, and static assets
- `config/` — theme settings schema and data
- `layout/` — top-level page layouts
- `locales/` — translations
- `sections/` — reusable page sections
- `snippets/` — reusable Liquid partials
- `templates/` — page templates (JSON + Liquid)

## Local development

```bash
shopify theme dev --store your-store.myshopify.com
```

Starts a local preview with live reload against the connected store.

## Deploying changes

```bash
shopify theme push
```

Pushes local changes to the selected theme on the connected store.
