import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {OpsDot} from 'sentry/components/events/opsBreakdown';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import Breakdown from 'sentry/views/insights/mobile/appStarts/components/breakdown';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';

const SYSTEM_COLOR = '#D6567F';
const APPLICATION_COLOR = '#444674';

const ANDROID_APPLICATION_SPAN_OPS = [
  'contentprovider.load',
  'application.load',
  'activity.load',
];

const IOS_APPLICATION_SPAN_DESCRIPTIONS = ['Initial Frame Render'];

// Since we don't collect a tag that indicates whether a span is system or
// application, we're going to use the span.op and span.description to
// determine whether a span is system or application.
function aggregateSystemApplicationBreakdown(data: TableDataRow[]) {
  return data.reduce((acc, row) => {
    const spanOp = row['span.op'] as string;
    const spanDescription = row['span.description'] as string;

    let type: 'system' | 'application' = 'system';
    if (
      ANDROID_APPLICATION_SPAN_OPS.includes(spanOp) ||
      IOS_APPLICATION_SPAN_DESCRIPTIONS.includes(spanDescription)
    ) {
      type = 'application';
    }

    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[row.release!] = {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      ...acc[row.release!],
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      [type]: (acc[row.release!]?.[type] ?? 0) + (row['sum(span.self_time)'] ?? 0),
    };

    return acc;
  }, {});
}

function SystemApplicationBreakdown({additionalFilters}: any) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    'span.op:[app.start.warm,app.start.cold,contentprovider.load,application.load,activity.load]',
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
    ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {data, isPending} = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: ['release', 'span.op', 'span.description', 'sum(span.self_time)'],
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

  if (isPending) {
    return <LoadingContainer isLoading />;
  }

  if (!data) {
    return (
      <EmptyStateWarning small>
        <p>{t('There was no app start data found for these two releases')}</p>
      </EmptyStateWarning>
    );
  }

  const breakdownByReleaseData = aggregateSystemApplicationBreakdown(data.data);

  const breakdownGroups = [
    {
      color: SYSTEM_COLOR,
      key: 'system',
      name: t('System'),
    },
    {
      color: APPLICATION_COLOR,
      key: 'application',
      name: t('Application'),
    },
  ];

  return (
    <MiniChartPanel
      title={t('System v. Application')}
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
          <StyledStartTypeDot style={{backgroundColor: SYSTEM_COLOR}} /> {t('System')}
        </LegendEntry>
        <LegendEntry>
          <StyledStartTypeDot style={{backgroundColor: APPLICATION_COLOR}} />
          {t('Application')}
        </LegendEntry>
      </Legend>
      <AppStartBreakdownContent>
        {primaryRelease && (
          <ReleaseAppStartBreakdown>
            <TextOverflow>{formatVersion(primaryRelease)}</TextOverflow>
            <Breakdown
              data-test-id="primary-release-breakdown"
              // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              row={breakdownByReleaseData[primaryRelease]}
              breakdownGroups={breakdownGroups}
            />
          </ReleaseAppStartBreakdown>
        )}
        {secondaryRelease && (
          <ReleaseAppStartBreakdown>
            <TextOverflow>{formatVersion(secondaryRelease)}</TextOverflow>
            <Breakdown
              data-test-id="secondary-release-breakdown"
              // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              row={breakdownByReleaseData[secondaryRelease]}
              breakdownGroups={breakdownGroups}
            />
          </ReleaseAppStartBreakdown>
        )}
      </AppStartBreakdownContent>
    </MiniChartPanel>
  );
}

export default SystemApplicationBreakdown;

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
