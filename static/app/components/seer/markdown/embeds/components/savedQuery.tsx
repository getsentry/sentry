import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeLogsPathname} from 'sentry/views/explore/logs/utils';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

type Dataset = EmbedOutput<'savedQuery'>['dataset'];

/**
 * Explore has no saved-query detail route. Opening one means loading the
 * dataset's own explore surface with the saved query's `id`.
 */
function datasetPathname(dataset: Dataset, organization: Organization): string {
  switch (dataset) {
    case 'logs':
      return makeLogsPathname({organizationSlug: organization.slug, path: '/'});
    case 'metrics':
      return makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
    case 'replays':
      return makeReplaysPathname({organization, path: '/'});
    case 'spans':
      return makeTracesPathname({organization, path: '/'});
    default:
      dataset satisfies never;
      return makeTracesPathname({organization, path: '/'});
  }
}

function SavedQueryLink({id, dataset, name}: EmbedOutput<'savedQuery'>) {
  const organization = useOrganization();
  const href = queryString.stringifyUrl({
    url: datasetPathname(dataset, organization),
    query: {id},
  });

  return (
    <ResourceLink icon={IconStar} href={href} title={name ?? t('Saved query %s', id)} />
  );
}

export const SavedQuery = defineSeerEmbed({
  name: 'savedQuery',
  render(props) {
    return <SavedQueryLink {...props} />;
  },
});
