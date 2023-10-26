import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

export function ScreenMetricsRibbon({additionalFilters}: {additionalFilters?: string[]}) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const {primaryRelease, isLoading: isReleasesLoading} = useReleaseSelection();

  const queryStringPrimary = appendReleaseFilters(searchQuery, primaryRelease, undefined);

  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields: [
      'avg(measurements.time_to_initial_display)', // TODO: Update these to avgIf with primary release when available
      'avg(measurements.time_to_full_display)',
      'count()',
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data, isLoading} = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
  });

  return (
    <BlockContainer>
      <Block title={t('Count')}>
        {!isLoading && data ? (
          <CountCell count={data.data[0]?.['count()'] as number} />
        ) : (
          '-'
        )}
      </Block>

      <Block title={t('Avg TTID')}>
        {!isLoading && data ? (
          <DurationCell
            milliseconds={
              data.data[0]?.['avg(measurements.time_to_initial_display)'] as number
            }
          />
        ) : (
          '-'
        )}
      </Block>
      <Block title={t('Avg TTFD')}>
        {!isLoading &&
        data &&
        data.data[0]?.['avg(measurements.time_to_full_display)'] !== 0 ? (
          <DurationCell
            milliseconds={
              data.data[0]?.['avg(measurements.time_to_full_display)'] as number
            }
          />
        ) : (
          '-'
        )}
      </Block>
    </BlockContainer>
  );
}
