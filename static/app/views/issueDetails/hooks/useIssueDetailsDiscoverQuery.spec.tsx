import {GroupFixture} from 'sentry-fixture/group';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useIssueDetailsEventView} from 'sentry/views/issueDetails/hooks/useIssueDetailsDiscoverQuery';

describe('useIssueDetailsEventView', () => {
  const group = GroupFixture();

  it('keeps an unfiltered query scoped to the issue', () => {
    const {result} = renderHookWithProviders(() => useIssueDetailsEventView({group}));

    expect(result.current.query).toBe(`issue:${group.shortId}`);
  });

  it('groups an additional OR filter independently of the search query', () => {
    const {result} = renderHookWithProviders(
      () =>
        useIssueDetailsEventView({
          group,
          queryProps: {query: 'release:one OR release:two'},
        }),
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/org-slug/issues/${group.id}/events/`,
            query: {query: 'tag_a:1 OR tag_b:2'},
          },
        },
      }
    );

    expect(result.current.query).toBe(
      `issue:${group.shortId} (tag_a:1 OR tag_b:2) (release:one OR release:two)`
    );
  });
});
