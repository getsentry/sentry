import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

function IssuesQueryLink({
  query,
  sort,
  title,
  projects,
  environments,
  statsPeriod,
  start,
  end,
}: EmbedOutput<'issuesQuery'>) {
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
    <ResourceLink icon={IconIssues} href={href} title={title ?? t('Issue search')} />
  );
}

export const IssuesQuery = defineSeerEmbed({
  name: 'issuesQuery',
  render(props) {
    return <IssuesQueryLink {...props} />;
  },
});
