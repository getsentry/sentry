export const AI_INSTRUMENTATION_DOCS_LINKS = {
  python:
    'https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/',
  javascript:
    'https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module/',
} as const;

/**
 * Resolves the AI agents instrumentation docs link for a project platform.
 * These pages document how to capture agent inputs and outputs. Defaults to
 * the Python guide when the platform is unknown, matching the onboarding flow.
 */
export function getAiInstrumentationDocsLink(platform?: string): string {
  if (platform?.startsWith('javascript') || platform?.startsWith('node')) {
    return AI_INSTRUMENTATION_DOCS_LINKS.javascript;
  }
  return AI_INSTRUMENTATION_DOCS_LINKS.python;
}
