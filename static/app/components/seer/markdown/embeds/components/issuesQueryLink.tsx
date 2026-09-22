import queryString from 'query-string';

import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getIssuesQueryHref(
  {
    query,
    sort,
    projects,
    environments,
    statsPeriod,
    start,
    end,
  }: EmbedOutput<'issuesQuery'>,
  organizationSlug: string
) {
  return queryString.stringifyUrl({
    url: normalizeUrl(`/organizations/${organizationSlug}/issues/`),
    query: {
      query,
      sort,
      project: projects,
      environment: environments,
      statsPeriod,
      start,
      end,
    },
  });
}

export function IssuesQueryLink({
  format,
  ...props
}: EmbedOutput<'issuesQuery'> & ResourceLinkFormatProps) {
  const organization = useOrganization();

  return (
    <ResourceLink
      format={format}
      icon={IconIssues}
      href={getIssuesQueryHref(props, organization.slug)}
      title={props.title ?? t('Issue search')}
    />
  );
}
