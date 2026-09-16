import queryString from 'query-string';

import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

function IssuesQueryLink({
  format,
  query,
  sort,
  title,
  projects,
  environments,
  statsPeriod,
  start,
  end,
}: EmbedOutput<'issuesQuery'> & ResourceLinkFormatProps) {
  const organization = useOrganization();
  const href = queryString.stringifyUrl({
    url: normalizeUrl(`/organizations/${organization.slug}/issues/`),
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

  return (
    <ResourceLink
      format={format}
      icon={IconIssues}
      href={href}
      title={title ?? t('Issue search')}
    />
  );
}

export const IssuesQuery = defineSeerEmbed({
  name: 'issuesQuery',
  render(props, level) {
    switch (level) {
      case 'markdown':
        return <IssuesQueryLink {...props} format="markdown" />;
      case 'block':
      case 'inline':
        return <IssuesQueryLink {...props} />;
    }
  },
});
