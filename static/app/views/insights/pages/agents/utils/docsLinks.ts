export const AI_INSTRUMENTATION_DOCS_LINKS = {
  python:
    'https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/',
  javascript:
    'https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module/',
} as const;

export const AI_AGENTS_GETTING_STARTED_DOCS_LINK =
  'https://docs.sentry.io/product/insights/ai/agents/getting-started/';

/**
 * Resolves the AI agents instrumentation docs link, which document how to
 * capture agent inputs and outputs. Accepts either a project platform
 * (e.g. `javascript-react`, `node`, `bun`, `deno`) or an SDK language
 * (`javascript`, `python`). Platforms without a dedicated guide fall back to
 * the platform-agnostic getting-started page.
 */
export function getAiInstrumentationDocsLink(platformOrLanguage?: string): string {
  if (
    platformOrLanguage?.startsWith('javascript') ||
    platformOrLanguage?.startsWith('node') ||
    platformOrLanguage === 'bun' ||
    platformOrLanguage === 'deno'
  ) {
    return AI_INSTRUMENTATION_DOCS_LINKS.javascript;
  }
  if (platformOrLanguage?.startsWith('python')) {
    return AI_INSTRUMENTATION_DOCS_LINKS.python;
  }
  return AI_AGENTS_GETTING_STARTED_DOCS_LINK;
}
