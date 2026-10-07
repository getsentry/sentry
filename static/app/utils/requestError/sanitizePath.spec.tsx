import {sanitizePath} from 'sentry/utils/requestError/sanitizePath';

describe('sanitizePath', () => {
  for (const prefix of ['https://sentry.io/api/0', '']) {
    test.each([
      // /organizations/ endpoints
      [
        // OrganizationGroupIndexEndpoint
        '/organizations/sentry/issues/',
        '/organizations/{orgSlug}/issues/',
      ],

      [
        // OrganizationEventDetailsEndpoint
        '/organizations/sentry/events/javascript:11a21f2012e12b31c2012a09d08a2013/',
        '/organizations/{orgSlug}/events/{projectSlug}:{eventId}/',
      ],

      [
        // OrganizationEventsEndpoint
        '/organizations/sentry/events/',
        '/organizations/{orgSlug}/events/',
      ],

      [
        // OrganizationEnvironmentsEndpoint
        '/organizations/sentry/environments/',
        '/organizations/{orgSlug}/environments/',
      ],

      [
        // OrganizationSentryAppComponentsEndpoint
        '/organizations/sentry/sentry-app-components/?projectId=4152013',
        '/organizations/{orgSlug}/sentry-app-components/',
      ],

      [
        // OrganizationPluginsConfigsEndpoint
        '/organizations/sentry/plugins/configs/',
        '/organizations/{orgSlug}/plugins/configs/',
      ],

      [
        // OrganizationMemberTeamDetailsEndpoint
        '/organizations/sentry/members/90813/teams/search-and-storage/',
        '/organizations/{orgSlug}/members/{memberId}/teams/{teamSlug}/',
      ],

      [
        // OrganizationReleaseDetailsEndpoint
        '/organizations/sentry/releases/v4.15.13/',
        '/organizations/{orgSlug}/releases/{releaseId}/',
      ],

      [
        // ReleaseDeploysEndpoint
        '/organizations/sentry/releases/v4.15.13/deploys/',
        '/organizations/{orgSlug}/releases/{releaseId}/deploys/',
      ],

      [
        // OrganizationTagsEndpoint
        '/organizations/sentry/tags/',
        '/organizations/{orgSlug}/tags/',
      ],

      [
        // OrganizationTagKeyValuesEndpoint
        '/organizations/sentry/tags/browser/values/',
        '/organizations/{orgSlug}/tags/{tagName}/values/',
      ],

      [
        // OrganizationSeerAgentChatEndpoint
        '/organizations/sentry/seer/explorer-chat/12345678/',
        '/organizations/{orgSlug}/seer/explorer-chat/{runId}/',
      ],

      [
        // OrganizationSeerAgentChatEndpoint
        '/organizations/sentry/seer/explorer-chat/',
        '/organizations/{orgSlug}/seer/explorer-chat/',
      ],

      [
        // OrganizationUserDetailsEndpoint
        '/organizations/sentry/users/123456/',
        '/organizations/{orgSlug}/users/{userId}/',
      ],

      [
        // ShortIdLookupEndpoint
        '/organizations/sentry/shortids/JAVASCRIPT-1A2B/',
        '/organizations/{orgSlug}/shortids/{shortId}/',
      ],

      [
        // OrganizationTraceItemAttributesEndpoint
        '/organizations/sentry/trace-items/attributes/',
        '/organizations/{orgSlug}/trace-items/attributes/',
      ],

      // /projects/ endpoints
      [
        // ProjectAlertRuleDetailsEndpoint
        '/projects/sentry/javascript/alert-rules/123113/',
        '/projects/{orgSlug}/{projectSlug}/alert-rules/{ruleId}/',
      ],

      [
        // ProjectStacktraceLinkEndpoint
        '/projects/sentry/javascript/stacktrace-link/',
        '/projects/{orgSlug}/{projectSlug}/stacktrace-link/',
      ],

      [
        // EventOwnersEndpoint
        '/projects/sentry/javascript/events/11a21f2012e12b31c2012a09d08a2013/owners/',
        '/projects/{orgSlug}/{projectSlug}/events/{eventId}/owners/',
      ],

      [
        // ProjectReleaseDetailsEndpoint
        '/projects/sentry/javascript/releases/v4.15.13/',
        '/projects/{orgSlug}/{projectSlug}/releases/{releaseId}/',
      ],

      [
        // ProjectTeamDetailsEndpoint
        '/projects/sentry/javascript/teams/search-and-storage/',
        '/projects/{orgSlug}/{projectSlug}/teams/{teamSlug}/',
      ],

      [
        // ProjectTraceItemDetailsEndpoint
        '/projects/sentry/javascript/trace-items/0123456789abcdef/',
        '/projects/{orgSlug}/{projectSlug}/trace-items/{itemId}/',
      ],

      [
        // ProjectProfilingProfileEndpoint
        '/projects/sentry/javascript/profiling/profiles/11a21f2012e12b31c2012a09d08a2013/',
        '/projects/{orgSlug}/{projectSlug}/profiling/profiles/{profileId}/',
      ],

      [
        // TeamReleaseCountEndpoint
        '/teams/sentry/search-and-storage/release-count/',
        '/teams/{orgSlug}/{teamSlug}/release-count/',
      ],

      [
        // CustomerDetailsEndpoint
        '/customers/sentry/',
        '/customers/{orgSlug}/',
      ],

      // replays endpionts
      [
        // ProjectReplayDetailsEndpoint
        '/projects/sentry/javascript/replays/9081341513/',
        '/projects/{orgSlug}/{projectSlug}/replays/{replayId}/',
      ],

      [
        // OrganizationReplayDetailsEndpoint
        '/organizations/sentry/replays/9081341513/',
        '/organizations/{orgSlug}/replays/{replayId}/',
      ],

      // groups endpoints
      [
        // GroupDetailsEndpoint
        '/issues/11211231/',
        '/issues/{issueId}/',
      ],

      [
        // GroupEventDetailsEndpoint
        '/issues/11211231/events/latest/',
        '/issues/{issueId}/events/latest/',
      ],

      [
        // GroupEventDetailsEndpoint
        '/issues/11211231/events/oldest/',
        '/issues/{issueId}/events/oldest/',
      ],

      [
        // GroupEventDetailsEndpoint
        '/issues/11211231/events/11a21f2012e12b31c2012a09d08a2013/',
        '/issues/{issueId}/events/{eventId}/',
      ],

      [
        // GroupIntegrationsEndpoint
        '/groups/11211231/integrations/',
        '/groups/{groupId}/integrations/',
      ],

      [
        // GroupExternalIssuesEndpoint
        '/groups/11211231/external-issues/',
        '/groups/{groupId}/external-issues/',
      ],

      // users endpoints
      [
        // UserEmailsEndpoint
        '/users/me/emails/',
        '/users/{userId}/emails/',
      ],

      [
        // SetupWizard
        '/wizard/abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def1/',
        '/wizard/{wizardHash}/',
      ],

      [
        // SetupWizard
        '/wizard/',
        '/wizard/',
      ],

      [
        // SentryAppsEndpoint
        '/sentry-apps/',
        '/sentry-apps/',
      ],
    ])(`sanitizes ${prefix}%s`, (path, expected) => {
      expect(sanitizePath(prefix + path)).toBe(prefix + expected);
    });
  }

  it('uses original value if placeholder type not found', () => {
    expect(sanitizePath('/organizations/sentry/dogName/maisey')).toBe(
      '/organizations/{orgSlug}/dogName/maisey'
    );
  });
});
