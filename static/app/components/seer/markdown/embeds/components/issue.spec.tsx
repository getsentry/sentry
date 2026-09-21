import {GroupFixture} from 'sentry-fixture/group';

import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Issue} from './issue';
import {
  getEmbedLinkHref,
  renderEmbed,
  renderEmbedMarkdown,
} from './resourceEmbedTestUtils';

describe('issue embed', () => {
  it('serializes to a markdown link at the markdown level', () => {
    expect(renderEmbedMarkdown(Issue, 'issue', {id: 'JAVASCRIPT-22SP'})).toBe(
      `[JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`
    );
  });

  it('labels the link with the short id and points it at the group id', () => {
    const href = getEmbedLinkHref('issue', 'JAVASCRIPT-22SP', {
      id: '7716642857',
      shortId: 'JAVASCRIPT-22SP',
    });

    expect(href).toBe('/issues/7716642857/');
  });

  it('falls back to the id when Seer has no short id', () => {
    renderEmbed({name: 'issue', data: {id: '7716642857'}, level: 'inline'});

    expect(screen.getByRole('link', {name: '7716642857'})).toBeInTheDocument();
  });

  describe('block', () => {
    function mockIssuesRequest() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        body: [],
      });
      return MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [GroupFixture({id: '7716642857', shortId: 'JAVASCRIPT-22SP'})],
      });
    }

    async function expectQuery(
      data: Record<string, unknown>,
      query: string
    ): Promise<void> {
      const issuesRequest = mockIssuesRequest();

      renderEmbed({name: 'issue', data});

      await waitFor(
        () =>
          expect(issuesRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({query: expect.objectContaining({query})})
          ),
        {timeout: 10_000}
      );
    }

    it('prefers the short id, which is what the issue filter resolves', async () => {
      await expectQuery(
        {id: '7716642857', shortId: 'JAVASCRIPT-22SP'},
        'issue:JAVASCRIPT-22SP'
      );
    });

    it('looks a bare numeric group id up with the issue.id filter', async () => {
      await expectQuery({id: '7716642857'}, 'issue.id:7716642857');
    });

    it('looks a bare short id up with the issue filter', async () => {
      await expectQuery({id: 'JAVASCRIPT-22SP'}, 'issue:JAVASCRIPT-22SP');
    });

    it('accepts a group id emitted as a bare number', async () => {
      await expectQuery({id: 7716642857}, 'issue.id:7716642857');
    });

    it('ignores a group id handed over as the short id', async () => {
      await expectQuery({id: '7716642857', shortId: '7716642857'}, 'issue.id:7716642857');
    });
  });
});
