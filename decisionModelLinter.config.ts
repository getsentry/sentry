// Sentry's decision-model lint rules: https://github.com/getsentry/decision-model-linter
import type {Config, Model, Suite} from '@sentry/decision-model-linter';

const jev = {
  provider: 'openrouter',
  name: 'typesafe/jev-1.13',
  apiKey: process.env.OPENROUTER_API_KEY,
  maxInputTokens: 32_768,
} satisfies Model;

const api = {
  rules: {
    addsNewOmittedFields: {
      prompt:
        'Does the code withhold a field from the public API schema by adding it to omit_from_public_schema in @sentry_schema_serializer(...)?',
      values: [
        {
          value: 'TRUE',
          description:
            'A field name and its reason are added to an omit_from_public_schema dict, so the field stays in the API but leaves the public schema and every generated SDK.',
          severity: 'warn',
          report:
            'This withholds a field from the public API schema and every generated SDK, though clients can still use it. Withhold a field only if it must never be public, and make its reason say why. To fix a missing description, add help_text to the field instead.',
        },
        {value: 'FALSE', description: 'No field is added to omit_from_public_schema.'},
      ],
    },
  },
} satisfies Suite;

export default {
  model: jev,
  files: ['src/sentry/**/*.py'],
  ignores: ['**/tests/**', '**/testutils/**'],
  suites: {api},
} satisfies Config;
