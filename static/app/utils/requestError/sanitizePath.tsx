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
  subscriptions: '{orgSlug}',
  tags: '{tagName}',
  teams: '{teamSlug}',
};

function getSlugPlaceholder(rawSlugType: string, slugValue: string): string {
  if (slugValue === '') {
    return slugValue;
  }

  // Pull off the trailing slash, if there is one
  const slugType = rawSlugType.replace(/\/$/, '');
  return slugType in TYPE_TO_PLACEHOLDER
    ? // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
        function (...args) {
          const matches = args[args.length - 1];

          let {type} = matches;
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

          // The `rule-conditions` endpoint really ought to be an org endpoint,
          // and it's formatted like one, so for now, let's treat it like one.
          // We can fix it before we return our final value. See
          // `ProjectAgnosticRuleConditionsEndpoint` in `sentry/api/urls.py`.
          if (third === 'rule-conditions/') {
            type = 'organizations';
          }

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
            }
          }

          // Now that we've handled all our special cases based on type, we can
          // restore the correct value for `rule-conditions`
          if (contentType === 'rule-conditions/') {
            type = 'projects';
          }

          return `${start}${type}/${primarySlugPlaceholder}${contentType}${secondarySlugPlaceholder}${contentSubtype}${tertiarySlugPlaceholder}${end}`;
        }
      )
  );
}
