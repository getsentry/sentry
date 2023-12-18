import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {OpsDot} from 'sentry/components/events/opsBreakdown';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import AppStartBreakdown, {
  COLD_START_COLOR,
  WARM_START_COLOR,
} from 'sentry/views/starfish/views/appStartup/appStartBreakdown';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

function AppStartBreakdownWidget({additionalFilters}) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    'span.op:[app.start.warm,app.start.cold]',
    ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = `${appendReleaseFilters(
    query,
    primaryRelease,
    secondaryRelease
  )} span.description:["Cold Start","Warm Start"]`;

  const {data, isLoading} = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', 'span.op', 'count()'],
        topEvents: '2',
        query: queryString,
        dataset: DiscoverDatasets.SPANS_METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-breakdown',
    initialData: {data: []},
  });

  if (isLoading) {
    return <LoadingContainer isLoading />;
  }

  if (!data) {
    return (
      <EmptyStateWarning small>
        <p>{t('There was no app start data found for these two releases')}</p>
      </EmptyStateWarning>
    );
  }

  const startsByReleaseSeries = data.data.reduce((acc, row) => {
    acc[row.release] = {...acc[row.release], [row['span.op']]: row['count()']};

    return acc;
  }, {});

  const keys = {coldStartKey: 'app.start.cold', warmStartKey: 'app.start.warm'};
  return (
    <MiniChartPanel
      title={t('App Start')}
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              formatVersionAndCenterTruncate(primaryRelease, 12),
              secondaryRelease ? formatVersionAndCenterTruncate(secondaryRelease, 12) : ''
            )
          : ''
      }
    >
      <Legend>
        <LegendEntry>
          <StyledStartTypeDot style={{backgroundColor: COLD_START_COLOR}} />{' '}
          {t('Cold Start')}
        </LegendEntry>
        <LegendEntry>
          <StyledStartTypeDot style={{backgroundColor: WARM_START_COLOR}} />
          {t('Warm Start')}
        </LegendEntry>
      </Legend>
      <AppStartBreakdownContent>
        {primaryRelease && (
          <ReleaseAppStartBreakdown>
            <TextOverflow>{formatVersion(primaryRelease)}</TextOverflow>
            <AppStartBreakdown {...keys} row={startsByReleaseSeries[primaryRelease]} />
          </ReleaseAppStartBreakdown>
        )}
        {secondaryRelease && (
          <ReleaseAppStartBreakdown>
            <TextOverflow>{formatVersion(secondaryRelease)}</TextOverflow>
            <AppStartBreakdown {...keys} row={startsByReleaseSeries[secondaryRelease]} />
          </ReleaseAppStartBreakdown>
        )}
      </AppStartBreakdownContent>
    </MiniChartPanel>
  );
}

export default AppStartBreakdownWidget;

const ReleaseAppStartBreakdown = styled('div')`
  display: grid;
  grid-template-columns: 20% auto;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
`;

const AppStartBreakdownContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const Legend = styled('div')`
  display: flex;
  gap: ${space(1.5)};
  position: absolute;
  top: ${space(1.5)};
  right: ${space(2)};
`;

const LegendEntry = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledStartTypeDot = styled(OpsDot)`
  position: relative;
  top: -1px;
`;
