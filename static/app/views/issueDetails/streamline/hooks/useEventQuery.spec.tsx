import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  getEventSearchFromIssueQuery,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/hooks/useEventQuery';

describe('useEventQuery', () => {
  const [tagKey, tagValue] = ['user.email', 'leander@s.io'];

  it('filters issue tokens from event queries', () => {
    const validQuery = `${tagKey}:${tagValue} device.family:[iphone,pixel]`;

    const {result: onlyIssueTokens} = renderHookWithProviders(useEventQuery, {
      initialRouterConfig: {
        location: {
          pathname: '/issues/1234/',
          query: {query: 'is:resolved assigned:[me,#issues] issue.priority:high'},
        },
        route: '/issues/:issueId/',
      },
    });
    expect(onlyIssueTokens.current).toBe('');

    const {result: combinedTokens} = renderHookWithProviders(useEventQuery, {
      initialRouterConfig: {
        location: {
          pathname: '/issues/1234/',
          query: {query: `is:resolved assigned:[me,#issues] ${validQuery}`},
        },
        route: '/issues/:issueId/',
      },
    });
    expect(combinedTokens.current).toBe(validQuery);

    const {result: onlyEventTokens} = renderHookWithProviders(useEventQuery, {
      initialRouterConfig: {
        location: {
          pathname: '/issues/1234/',
          query: {query: validQuery},
        },
        route: '/issues/:issueId/',
      },
    });
    expect(onlyEventTokens.current).toBe(validQuery);
  });
});

describe('sanitizeEventQuery', () => {
  it('should remove basic issue filters from query', () => {
    const query = `is:unresolved level:error`;
    const sanitizedQuery = getEventSearchFromIssueQuery(query);
    expect(sanitizedQuery).toBe('level:error');
  });

  it('handles has/!has by removing disallowed fields and keeping allowed ones', () => {
    // environment is excluded; user.email is an allowed event field
    const query = `has:environment has:user.email !has:transaction.status !has:user.id`;
    const sanitizedQuery = getEventSearchFromIssueQuery(query);
    // Should drop has:environment and !has:transaction.status, keep has:user.email and !has:user.id
    expect(sanitizedQuery).toBe('has:user.email !has:user.id');
  });
});
