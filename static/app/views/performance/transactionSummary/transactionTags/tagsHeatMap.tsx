import {Fragment, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useOverlay} from '@react-aria/overlays';
import {useOverlayTriggerState} from '@react-stately/overlays';
import {truncate} from '@sentry/utils';
import type {VisualMapComponentOption} from 'echarts';
import type {Location} from 'history';
import memoize from 'lodash/memoize';

import HeatMapChart from 'sentry/components/charts/heatMapChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import Panel from 'sentry/components/panels/panel';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DropdownItem, SectionSubtext} from 'sentry/components/quickTrace/styles';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef, Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import type EventView from 'sentry/utils/discover/eventView';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {
  TableData as TagTableData,
  TableDataRow,
} from 'sentry/utils/performance/segmentExplorer/tagKeyHistogramQuery';
import TagTransactionsQuery from 'sentry/utils/performance/segmentExplorer/tagTransactionsQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import {TraceViewSources} from '../../newTraceDetails/traceHeader/breadcrumbs';
import Tab from '../tabs';
import {eventsRouteWithQuery} from '../transactionEvents/utils';

import {parseHistogramBucketInfo, trackTagPageInteraction} from './utils';

type Props = {
  aggregateColumn: string;
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey?: string;
};

const findRowKey = (row: TableDataRow) => {
  return Object.keys(row).find(key => key.includes('histogram'));
};

class VirtualReference {
  boundingRect: DOMRect;

  constructor(element: HTMLElement) {
    this.boundingRect = element.getBoundingClientRect();
  }

  getBoundingClientRect() {
    return this.boundingRect;
  }

  get clientWidth() {
    return this.getBoundingClientRect().width;
  }

  get clientHeight() {
    return this.getBoundingClientRect().height;
  }
}

const getPortal = memoize((): HTMLElement => {
  let portal = document.getElementById('heatmap-portal');

  if (portal) {
    return portal;
  }

  portal = document.createElement('div');
  portal.setAttribute('id', 'heatmap-portal');
  document.body.appendChild(portal);

  return portal;
});

function TagsHeatMap(
  props: Props & {
    isLoading: boolean;
    tableData: TagTableData | null;
  }
) {
  const {
    tableData,
    isLoading,
    organization,
    eventView,
    location,
    tagKey,
    transactionName,
    aggregateColumn,
  } = props;

  const chartRef = useRef<ReactEchartsRef>(null);
  const [chartElement, setChartElement] = useState<VirtualReference | undefined>();
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);
  const [overlayArrowElement, setOverlayArrowElement] = useState<HTMLElement | null>(
    null
  );
  const [transactionEventView, setTransactionEventView] = useState<
    EventView | undefined
  >();

  // TODO(k-fish): Replace with actual theme colors.
  const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

  const xValues = new Set();

  const histogramData = tableData?.histogram?.data?.length
    ? tableData.histogram.data
    : undefined;
  const tagData = tableData?.tags?.data ? tableData.tags.data : undefined;

  const rowKey = histogramData && findRowKey(histogramData[0]!);

  // Reverse since e-charts takes the axis labels in the opposite order.
  const columnNames = tagData ? tagData.map(tag => tag.tags_value).reverse() : [];

  let maxCount = 0;

  const _data =
    rowKey && histogramData
      ? histogramData.map(row => {
          const rawDuration = row[rowKey] as number;
          const x = getPerformanceDuration(rawDuration);
          const y = row.tags_value;
          xValues.add(x);

          maxCount = Math.max(maxCount, row.count);

          return [x, y, row.count] as number[];
        })
      : null;

  _data?.sort((a, b) => {
    const i = b[0] === a[0] ? 1 : 0;
    return b[i]! - a[i]!;
  });

  // TODO(k-fish): Cleanup options
  const chartOptions = {
    height: 290,
    animation: false,
    colors: purples,
    tooltip: {},
    yAxis: {
      type: 'category' as const,
      data: Array.from(columnNames),
      splitArea: {
        show: true,
      },
      axisLabel: {
        formatter: (value: string) => truncate(value, 30),
      },
    },
    xAxis: {
      type: 'category' as const,
      splitArea: {
        show: true,
      },
      data: Array.from(xValues),
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: number) => axisLabelFormatter(value, 'number'),
      },
      axisLine: {},
      axisPointer: {
        show: false,
      },
      axisTick: {
        show: true,
        interval: 0,
        alignWithLabel: true,
      },
    },

    grid: {
      left: space(3),
      right: space(3),
      top: '25px', // Need to bump top spacing past space(3) so the chart title doesn't overlap.
      bottom: space(4),
    },
  };

  const visualMaps: VisualMapComponentOption[] = [
    {
      min: 0,
      max: maxCount,
      show: false,
      orient: 'horizontal',
      calculable: true,
      inRange: {
        color: purples,
      },
    },
  ];

  const series: Series[] = [];

  if (_data) {
    series.push({
      seriesName: 'Count',
      dataArray: _data,
      label: {
        show: true,
        formatter: (data: any) => formatAbbreviatedNumber(data.value[2]),
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    } as any); // TODO(k-fish): Fix heatmap data typing
  }

  const onChartClick = (bucket: any) => {
    const htmlEvent = bucket.event.event;
    // Make a copy of the dims because echarts can remove elements after this click happens.
    // TODO(k-fish): Look at improving this to respond properly to resize events.
    const virtualRef = new VirtualReference(htmlEvent.target);
    setChartElement(virtualRef);

    const newTransactionEventView = eventView.clone();

    // We need the traceSlug here to navigate to the transaction in the trace view.
    newTransactionEventView.fields = [{field: aggregateColumn}, {field: 'trace'}];
    const [_, tagValue] = bucket.value;

    if (histogramBucketInfo && histogramData) {
      const row = histogramData[bucket.dataIndex];
      const currentBucketStart = parseInt(
        `${row![histogramBucketInfo.histogramField]}`,
        10
      );
      const currentBucketEnd = currentBucketStart + histogramBucketInfo.bucketSize;

      newTransactionEventView.additionalConditions.setFilterValues(aggregateColumn, [
        `>=${currentBucketStart}`,
        `<${currentBucketEnd}`,
      ]);
    }

    if (tagKey) {
      newTransactionEventView.additionalConditions.setFilterValues(tagKey, [tagValue]);
    }

    setTransactionEventView(newTransactionEventView);
    trackTagPageInteraction(organization);

    if (!overlayState.isOpen) {
      overlayState.open();
    }
  };

  const overlayState = useOverlayTriggerState({});
  const {overlayProps} = useOverlay(
    {
      isOpen: overlayState.isOpen,
      onClose: overlayState.close,
      isDismissable: true,
      shouldCloseOnBlur: true,
      // Ignore the menu being closed if the echart is being clicked.
      shouldCloseOnInteractOutside: el =>
        !chartRef.current?.getEchartsInstance().getDom().contains(el),
    },
    {current: overlayElement ?? null}
  );

  const {styles: popperStyles, state: popperState} = usePopper(
    chartElement,
    overlayElement,
    {
      placement: 'bottom',
      strategy: 'absolute',
      modifiers: [
        {name: 'computeStyles', options: {gpuAcceleration: false}},
        {name: 'offset', options: {offset: [0, 8]}},
        {name: 'arrow', options: {element: overlayArrowElement, padding: 4}},
        {name: 'preventOverflow', enabled: true, options: {padding: 12, altAxis: true}},
      ],
    }
  );

  const theme = useTheme();
  const portaledContent =
    !chartElement || !overlayState.isOpen ? null : (
      <PositionWrapper
        ref={setOverlayElement}
        zIndex={theme.zIndex.dropdown}
        style={popperStyles.popper}
        {...overlayProps}
      >
        <Overlay
          arrowProps={{
            ref: setOverlayArrowElement,
            style: popperStyles.arrow,
            placement: popperState?.placement,
          }}
        >
          {transactionEventView && (
            <TagTransactionsQuery
              query={transactionEventView.getQueryWithAdditionalConditions()}
              location={location}
              eventView={transactionEventView}
              orgSlug={organization.slug}
              limit={4}
              referrer="api.performance.tag-page"
            >
              {({isLoading: isTransactionsLoading, tableData: transactionTableData}) => {
                if (isTransactionsLoading) {
                  return (
                    <LoadingContainer>
                      <LoadingIndicator size={40} hideMessage />
                    </LoadingContainer>
                  );
                }

                const moreEventsTarget = eventsRouteWithQuery({
                  orgSlug: organization.slug,
                  transaction: transactionName,
                  projectID: decodeScalar(location.query.project),
                  query: {
                    ...transactionEventView.generateQueryStringObject(),
                    query: transactionEventView.getQueryWithAdditionalConditions(),
                  },
                });

                return (
                  <div>
                    {!transactionTableData?.data.length ? <Placeholder /> : null}
                    {[...(transactionTableData?.data ?? [])].slice(0, 3).map(row => {
                      const target = generateLinkToEventInTraceView({
                        eventId: row.id,
                        traceSlug: row.trace?.toString()!,
                        projectSlug: (row.project || row['project.name'])!.toString(),
                        timestamp: row.timestamp!,
                        location: {
                          ...location,
                          query: {
                            ...location.query,
                            tab: Tab.TAGS,
                          },
                        },
                        organization,
                        transactionName,
                        source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
                      });

                      return (
                        <DropdownItem width="small" key={row.id} to={target}>
                          <DropdownItemContainer>
                            <Truncate value={row.id} maxLength={12} />
                            <SectionSubtext>
                              <PerformanceDuration
                                milliseconds={Number(row[aggregateColumn])}
                                abbreviation
                              />
                            </SectionSubtext>
                          </DropdownItemContainer>
                        </DropdownItem>
                      );
                    })}
                    {moreEventsTarget &&
                    transactionTableData &&
                    transactionTableData.data.length > 3 ? (
                      <DropdownItem width="small" to={moreEventsTarget}>
                        <DropdownItemContainer>
                          {t('View all events')}
                        </DropdownItemContainer>
                      </DropdownItem>
                    ) : null}
                  </div>
                );
              }}
            </TagTransactionsQuery>
          )}
        </Overlay>
      </PositionWrapper>
    );

  const histogramBucketInfo =
    histogramData && parseHistogramBucketInfo(histogramData[0]!);

  return (
    <StyledPanel>
      <StyledHeaderTitleLegend>
        {t('Heat Map')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            'This heatmap shows the frequency for each duration across the most common tag values'
          )}
        />
      </StyledHeaderTitleLegend>

      <TransitionChart loading={isLoading} reloading={isLoading}>
        <TransparentLoadingMask visible={isLoading} />
        <Fragment>
          {createPortal(<div>{portaledContent}</div>, getPortal())}
          {getDynamicText({
            value: (
              <HeatMapChart
                ref={chartRef}
                visualMaps={visualMaps}
                series={series}
                onClick={onChartClick}
                {...chartOptions}
              />
            ),
            fixed: <Placeholder height="290px" testId="skeleton-ui" />,
          })}
        </Fragment>
      </TransitionChart>
    </StyledPanel>
  );
}

const LoadingContainer = styled('div')`
  width: 200px;
  height: 100px;

  display: flex;
  align-items: center;
  justify-content: center;
`;

const DropdownItemContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: row;

  justify-content: space-between;
`;

const StyledPanel = styled(Panel)`
  padding: ${space(3)} ${space(3)} 0 ${space(3)};
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
`;

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)``;

export default TagsHeatMap;
