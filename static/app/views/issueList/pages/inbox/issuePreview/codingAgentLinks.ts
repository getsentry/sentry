import type {Group} from 'sentry/types/group';

export type LocalCodingAgent = 'cursor' | 'codex' | 'claude-code';

export function getCodingAgentLinks(
  {permalink, shortId}: Pick<Group, 'permalink' | 'shortId'>,
  summary: string
): Record<LocalCodingAgent, string> {
  const prompt = encodeURIComponent(
    [
      `Fix Sentry issue ${shortId}: ${permalink}`,
      'Use the Sentry MCP to fetch the issue details.',
      summary && `Summary: ${summary}`,
    ]
      .filter(Boolean)
      .join('\n\n')
      .toWellFormed()
  );
  return {
    cursor: `cursor://anysphere.cursor-deeplink/prompt?text=${prompt}`,
    codex: `codex://new?prompt=${prompt}`,
    'claude-code': `claude://code/new?q=${prompt}`,
  };
}
