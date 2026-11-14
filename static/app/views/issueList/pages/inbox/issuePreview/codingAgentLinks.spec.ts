import {GroupFixture} from 'sentry-fixture/group';

import {getCodingAgentLinks} from './codingAgentLinks';

describe('getCodingAgentLinks', () => {
  const group = GroupFixture({
    shortId: 'APP-123',
    permalink: 'https://example.com/issues/1/',
  });

  it('encodes the same MCP prompt for all three apps', () => {
    const summary = 'Requests time out: café & 50% ? # 🚀';
    const prompt = encodeURIComponent(
      `Fix Sentry issue APP-123: https://example.com/issues/1/\n\nUse the Sentry MCP to fetch the issue details.\n\nSummary: ${summary}`
    );
    expect(getCodingAgentLinks(group, summary)).toEqual({
      cursor: `cursor://anysphere.cursor-deeplink/prompt?text=${prompt}`,
      codex: `codex://new?prompt=${prompt}`,
      'claude-code': `claude://code/new?q=${prompt}`,
    });
  });

  it('omits the summary when none is available', () => {
    const links = getCodingAgentLinks(group, '');
    const prompt = new URL(links.cursor).searchParams.get('text');
    expect(prompt).toBe(
      'Fix Sentry issue APP-123: https://example.com/issues/1/\n\nUse the Sentry MCP to fetch the issue details.'
    );
  });
});
