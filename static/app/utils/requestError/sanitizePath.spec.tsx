import {sanitizePath} from 'sentry/utils/requestError/sanitizePath';

describe('sanitizePath', function () {
  test.each([
    // /organizations/ endpoints
    ['/organizations/sentry-test/issues/', '/organizations/{orgSlug}/issues/'],
    ['/organizations/sentry-test/issues/123/', '/organizations/{orgSlug}/issues/123/'],
    ['/issues/123/', '/issues/{issueId}/'],
    ['/issues/3679937913/events/latest/', '/issues/{issueId}/events/latest/'],

    // https://github.com/getsentry/sentry/blob/8d4482f01aa2122c6f6670ab84f9263e6f021467/src/sentry/api/urls.py#L1004
    // r"^(?P<organization_slug>[^\/]+)/events/(?P<project_slug>[^\/]+):(?P<event_id>(?:\d+|[A-Fa-f0-9-]{32,36}))/$",
    [
      '/organizations/sentry-test/events/project-test:123/',
      '/organizations/{orgSlug}/events/{projectSlug}:123/',
    ],

    [
      'https://sentry.io/api/0/organizations/sentry-test/events/',
      'https://sentry.io/api/0/organizations/{orgSlug}/events/',
    ],

    // https://github.com/getsentry/sentry/blob/8d4482f01aa2122c6f6670ab84f9263e6f021467/src/sentry/api/urls.py#L1235
    // r"^(?P<organization_slug>[^\/]+)/members/(?P<member_id>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$",
    [
      '/organizations/sentry-test/members/123/teams/team-test/',
      '/organizations/{orgSlug}/members/123/teams/{teamSlug}/',
    ],

    [
      'https://sentry.io/api/0/organizations/sentry-test/issues/123/',
      'https://sentry.io/api/0/organizations/{orgSlug}/issues/123/',
    ],

    // /projects/ endpoints
    [
      '/projects/sentry-test/project-test/alert-rules/123/',
      '/projects/{orgSlug}/{projectSlug}/alert-rules/123/',
    ],

    [
      'https://sentry.io/api/0/projects/sentry-test/project-test/alert-rules/123/',
      'https://sentry.io/api/0/projects/{orgSlug}/{projectSlug}/alert-rules/123/',
    ],

    // https://github.com/getsentry/sentry/blob/8d4482f01aa2122c6f6670ab84f9263e6f021467/src/sentry/api/urls.py#L1894
    // r"^(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/teams/(?P<team_slug>[^\/]+)/$",
    [
      '/projects/sentry-test/project-test/teams/test-team/',
      '/projects/{orgSlug}/{projectSlug}/teams/{teamSlug}/',
    ],

    // XXX: This should probably be an organization endpoint...
    // https://github.com/getsentry/sentry/blob/8d4482f01aa2122c6f6670ab84f9263e6f021467/src/sentry/api/urls.py#L1595
    // r"^(?P<organization_slug>[^\/]+)/rule-conditions/$",
    ['/projects/sentry-test/rule-conditions/', '/projects/{orgSlug}/rule-conditions/'],

    [
      '/teams/sentry-test/team-test/release-count/',
      '/teams/{orgSlug}/{teamSlug}/release-count/',
    ],

    [
      'https://sentry.io/api/0/teams/sentry-test/team-test/release-count/',
      'https://sentry.io/api/0/teams/{orgSlug}/{teamSlug}/release-count/',
    ],

    // customers is org-like
    ['/customers/sentry-test/', '/customers/{orgSlug}/'],
    ['/customers/sentry-test/issues/', '/customers/{orgSlug}/issues/'],
    ['/customers/sentry-test/issues/123/', '/customers/{orgSlug}/issues/123/'],

    [
      '/projects/sentry/javascript/replays/123/',
      '/projects/{orgSlug}/{projectSlug}/replays/{replayId}/',
    ],
  ])('sanitizes %s', (path, expected) => {
    expect(sanitizePath(path)).toBe(expected);
  });
});
