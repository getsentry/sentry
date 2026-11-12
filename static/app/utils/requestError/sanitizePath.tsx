/**
 * Remove slugs from the path - we do not want them displayed in the Issues Stream (having them in issue details is ok)
 */

const TYPE_TO_PLACEHOLDER = {
  'alert-rules': '{ruleId}',
  customers: '{orgSlug}',
  environments: '{environmentId}',
  events: '{eventId}',
  groups: '{groupId}',
  issues: '{issueId}',
  members: '{memberId}',
  organizations: '{orgSlug}',
  projects: '{projectSlug}',
  releases: '{releaseId}',
  replays: '{replayId}',
  shortids: '{shortId}',
  subscriptions: '{orgSlug}',
  tags: '{tagName}',
  teams: '{teamSlug}',
  users: '{userId}',
};

function getSlugPlaceholder(rawSlugType: string, slugValue: string): string {
  if (slugValue === '') {
    return slugValue;
  }

  // Pull off the trailing slash, if there is one
  const slugType = rawSlugType.replace(/\/$/, '');
  return slugType in TYPE_TO_PLACEHOLDER
    ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      TYPE_TO_PLACEHOLDER[slugType] + '/'
    : slugValue;
}

export function sanitizePath(path: string) {
  return (
    path
      // Remove any querystring
      .split('?')[0]!
      .replace(
        /(?<start>.*?\/)(?<type>organizations|issues|groups|customers|subscriptions|projects|teams|users)\/(?<second>[^/]+)\/(?<third>[^/]+\/)?(?<fourth>[^/]+\/)?(?<fifth>[^/]+\/)?(?<sixth>[^/]+\/)?(?<seventh>[^/]+\/)?(?<end>.*)/,
        (...args) => {
          const matches = args[args.length - 1];

          const {type} = matches;
          const {
            start,
            second,
            third = '',
            fourth = '',
            fifth = '',
            sixth = '',
            seventh = '',
            end,
          } = matches;

          const isOrgLike = [
            'organizations',
            'customers',
            'issues',
            'groups',
            'users',
            'subscriptions',
          ].includes(type);
          const isProjectLike = ['projects', 'teams'].includes(type);

          // Org-like urls look like `/<type>/<slug>/<contentType>/...`, whereas
          // project-like urls look like `/<type>/<org-slug>/<slug>/<contentType>/...`.
          const primarySlug = isOrgLike ? second : third;
          const contentType = isOrgLike ? third : fourth;
          const secondarySlug = isOrgLike ? fourth : fifth;
          const contentSubtype = isOrgLike ? fifth : sixth;
          const tertiarySlug = isOrgLike ? sixth : seventh;

          let primarySlugPlaceholder = getSlugPlaceholder(type, primarySlug);
          let secondarySlugPlaceholder = getSlugPlaceholder(contentType, secondarySlug);
          let contentSubtypePlaceholder = contentSubtype;
          const tertiarySlugPlaceholder = getSlugPlaceholder(
            contentSubtype,
            tertiarySlug
          );

          if (isProjectLike) {
            primarySlugPlaceholder = '{orgSlug}/' + primarySlugPlaceholder;
          }

          if (isOrgLike) {
            if (contentType === 'events/') {
              if (secondarySlug.includes(':')) {
                // OrganizationEventDetailsEndpoint
                secondarySlugPlaceholder = '{projectSlug}:{eventId}/';
              } else if (['latest/', 'oldest/'].includes(secondarySlug)) {
                // GroupEventDetailsEndpoint
                secondarySlugPlaceholder = secondarySlug;
              }
            } else if (contentType === 'plugins/') {
              if (secondarySlug === 'configs/') {
                // OrganizationPluginsConfigsEndpoint
                secondarySlugPlaceholder = secondarySlug;
              }
            } else if (contentType === 'seer/') {
              if (secondarySlug === 'explorer-chat/' && contentSubtype) {
                // OrganizationSeerAgentChatEndpoint
                contentSubtypePlaceholder = '{runId}/';
              }
            }
          }

          if (isProjectLike) {
            if (contentType === 'trace-items/' && secondarySlug) {
              // ProjectTraceItemDetailsEndpoint (org-level trace-items/ only has
              // static subpaths, so this is limited to projects)
              secondarySlugPlaceholder = '{itemId}/';
            } else if (
              contentType === 'profiling/' &&
              secondarySlug === 'profiles/' &&
              contentSubtype
            ) {
              // ProjectProfilingProfileEndpoint
              contentSubtypePlaceholder = '{profileId}/';
            }
          }

          return `${start}${type}/${primarySlugPlaceholder}${contentType}${secondarySlugPlaceholder}${contentSubtypePlaceholder}${tertiarySlugPlaceholder}${end}`;
        }
      )
      // SetupWizard
      .replace(/\/wizard\/[^/]+(\/|$)/, '/wizard/{wizardHash}$1')
  );
}
