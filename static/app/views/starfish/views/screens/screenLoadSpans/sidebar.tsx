import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MiniAggregateWaterfall} from 'sentry/views/performance/browser/webVitals/components/miniAggregateWaterfall';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {YAxis} from 'sentry/views/starfish/views/screens';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

type ScreenMetrics = {
  [key in YAxis]: number;
};

type Props = {
  transaction: string;
  screenMetrics?: ScreenMetrics;
};

export function ScreenLoadSpansSidebar({transaction}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const searchQuery = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    `transaction:${transaction}`,
  ]);

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const newQuery: NewQuery = {
    name: 'ScreenMetricsRibbon',
    fields: [
      `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${primaryRelease})`,
      `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`,
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

  const undefinedText = '--';

  return (
    <Fragment>
      <SectionHeading>{t('Count')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : formatAbbreviatedNumber(data?.data[0]?.['count()'] as number)}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTID (Release 1)')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : getDuration(
              (data?.data[0]?.[
                `avg_if(measurements.time_to_initial_display,release,${primaryRelease})`
              ] as number) / 1000,
              2,
              true
            )}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTID (Release 2)')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : getDuration(
              (data?.data[0]?.[
                `avg_if(measurements.time_to_initial_display,release,${secondaryRelease})`
              ] as number) / 1000,
              2,
              true
            )}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTFD (Release 1)')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : getDuration(
              (data?.data[0]?.[
                `avg_if(measurements.time_to_full_display,release,${primaryRelease})`
              ] as number) / 1000,
              2,
              true
            )}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Avg TTFD (Release 2)')}</SectionHeading>
      <SidebarMetricsValue>
        {isLoading
          ? undefinedText
          : getDuration(
              (data?.data[0]?.[
                `avg_if(measurements.time_to_full_display,release,${secondaryRelease})`
              ] as number) / 1000,
              2,
              true
            )}
      </SidebarMetricsValue>
      <SidebarSpacer />
      <SectionHeading>{t('Aggregate Spans')}</SectionHeading>
      <MiniAggregateWaterfallContainer>
        <MiniAggregateWaterfall
          transaction={transaction}
          aggregateSpansLocation={{
            ...location,
            pathname: '/performance/summary/aggregateWaterfall',
            query: omit(location.query, ['primaryRelease', 'secondaryRelease']),
          }}
        />
      </MiniAggregateWaterfallContainer>
    </Fragment>
  );
}

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const MiniAggregateWaterfallContainer = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const SidebarMetricsValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
