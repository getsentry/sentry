import * as qs from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {EventView} from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

const DEFAULT_FIELDS = ['title', 'event.type', 'project', 'user.display', 'timestamp'];

function ErrorsQueryLink({
  query,
  fields,
  yAxes,
  sort,
  title,
  projects,
  environments,
  statsPeriod,
  start,
  end,
}: EmbedOutput<'errorsQuery'>) {
  const organization = useOrganization();

  // Discover encodes a lot of interdependent state (columns, sorts, chart
  // aggregates), so round-trip through EventView rather than hand-rolling it.
  const eventView = EventView.fromSavedQuery({
    version: 2,
    name: title ?? t('Errors'),
    query,
    fields: fields ?? DEFAULT_FIELDS,
    orderby: sort ?? '-timestamp',
    projects: projects?.map(Number),
    environment: environments,
    range: statsPeriod,
    start,
    end,
    yAxis: yAxes,
    queryDataset: SavedQueryDatasets.ERRORS,
  });

  const target = eventView.getResultsViewUrlTarget(
    organization,
    false,
    SavedQueryDatasets.ERRORS
  );
  const href = `${target.pathname}?${qs.stringify(target.query, {skipNull: true})}`;

  return (
    <ResourceLink icon={IconSearch} href={href} title={title ?? t('Error search')} />
  );
}

export const ErrorsQuery = defineSeerEmbed({
  name: 'errorsQuery',
  render(props) {
    return <ErrorsQueryLink {...props} />;
  },
});
