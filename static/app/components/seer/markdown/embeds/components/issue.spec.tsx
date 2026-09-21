import {GroupFixture} from 'sentry-fixture/group';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {Issue} from './issue';
import {renderEmbed, renderEmbedMarkdown} from './resourceEmbedTestUtils';

describe('issue embed', () => {
  it('serializes to a markdown link at the markdown level', () => {
    expect(renderEmbedMarkdown(Issue, 'issue', {id: 'JAVASCRIPT-22SP'})).toBe(
      `[JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`
    );
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

    it('looks a short id up with the issue filter', async () => {
      const issuesRequest = mockIssuesRequest();

      renderEmbed({name: 'issue', data: {id: 'JAVASCRIPT-22SP'}});

      await waitFor(
        () =>
          expect(issuesRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              query: expect.objectContaining({query: 'issue:JAVASCRIPT-22SP'}),
            })
          ),
        {timeout: 10_000}
      );
    });

    it('looks a numeric group id up with the issue.id filter', async () => {
      const issuesRequest = mockIssuesRequest();

      renderEmbed({name: 'issue', data: {id: '7716642857'}});

      await waitFor(
        () =>
          expect(issuesRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              query: expect.objectContaining({query: 'issue.id:7716642857'}),
            })
          ),
        {timeout: 10_000}
      );
    });
  });
});
