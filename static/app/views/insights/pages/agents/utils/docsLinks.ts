export const AI_INSTRUMENTATION_DOCS_LINKS = {
  python:
    'https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/',
  javascript:
    'https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module/',
} as const;

/**
 * Resolves the AI agents instrumentation docs link, which document how to
 * capture agent inputs and outputs. Accepts either a project platform
 * (e.g. `javascript-react`, `node`) or an SDK language (`javascript`,
 * `python`), and defaults to the Python guide when it can't be matched.
 */
export function getAiInstrumentationDocsLink(platformOrLanguage?: string): string {
  if (
    platformOrLanguage?.startsWith('javascript') ||
    platformOrLanguage?.startsWith('node')
  ) {
    return AI_INSTRUMENTATION_DOCS_LINKS.javascript;
  }
  return AI_INSTRUMENTATION_DOCS_LINKS.python;
}
