import React, {useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Popper} from 'react-popper';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {truncate} from '@sentry/utils';
import classNames from 'classnames';
import {EChartOption} from 'echarts';
import {Location} from 'history';
import memoize from 'lodash/memoize';

import HeatMapChart from 'app/components/charts/heatMapChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {Content} from 'app/components/dropdownControl';
import DropdownMenu from 'app/components/dropdownMenu';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {
  DropdownContainer,
  DropdownItem,
  SectionSubtext,
} from 'app/components/quickTrace/styles';
import Truncate from 'app/components/truncate';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {ReactEchartsRef, Series} from 'app/types/echarts';
import {axisLabelFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import getDynamicText from 'app/utils/getDynamicText';
import {TableData as TagTableData} from 'app/utils/performance/segmentExplorer/tagKeyHistogramQuery';
import TagTransactionsQuery from 'app/utils/performance/segmentExplorer/tagTransactionsQuery';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';

import {getPerformanceDuration, PerformanceDuration} from '../../utils';
import {eventsRouteWithQuery} from '../transactionEvents/utils';
import {generateTransactionLink} from '../utils';

import {parseHistogramBucketInfo, trackTagPageInteraction} from './utils';

type Props = {
  eventView: EventView;
  location: Location;
  aggregateColumn: string;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
};

const findRowKey = row => {
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
  if (!portal) {
    portal = document.createElement('div');
    portal.setAttribute('id', 'heatmap-portal');
    document.body.appendChild(portal);
  }
  return portal;
});

const TagsHeatMap = (
  props: Props & {
    theme: Theme;
    tableData: TagTableData | null;
    isLoading: boolean;
  }
) => {
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
  const [transactionEventView, setTransactionEventView] = useState<
    EventView | undefined
  >();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // TODO(k-fish): Replace with actual theme colors.
  const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

  const xValues = new Set();

  const histogramData =
    tableData &&
    tableData.histogram &&
    tableData.histogram.data &&
    tableData.histogram.data.length
      ? tableData.histogram.data
      : undefined;
  const tagData =
    tableData && tableData.tags && tableData.tags.data ? tableData.tags.data : undefined;

  const rowKey = histogramData && findRowKey(histogramData[0]);

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

  _data &&
    _data.sort((a, b) => {
      if (a[0] === b[0]) {
        return b[1] - a[1];
      }
      return b[0] - a[0];
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
    } as any, // TODO(k-fish): Expand typing to allow data option
    xAxis: {
      boundaryGap: true,
      type: 'category' as const,
      splitArea: {
        show: true,
      },
      data: Array.from(xValues),
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: number) => axisLabelFormatter(value, 'Count'),
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
    } as any, // TODO(k-fish): Expand typing to allow data option

    grid: {
      left: space(3),
      right: space(3),
      top: '25px', // Need to bump top spacing past space(3) so the chart title doesn't overlap.
      bottom: space(4),
    },
  };

  const visualMaps = [
    {
      min: 0,
      max: maxCount,
      show: false,
      orient: 'horizontal',
      calculable: true,
      inRange: {
        color: purples,
      },
    } as EChartOption.VisualMap,
  ];

  const series: Series[] = [];

  if (_data) {
    series.push({
      seriesName: 'Count',
      dataArray: _data,
      label: {
        show: true,
        formatter: data => formatAbbreviatedNumber(data.value[2]),
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    } as any); // TODO(k-fish): Fix heatmap data typing
  }

  const onOpenMenu = () => {
    setIsMenuOpen(true);
  };

  const onCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const shouldIgnoreMenuClose = e => {
    if (chartRef.current?.getEchartsInstance().getDom().contains(e.target)) {
      // Ignore the menu being closed if the echart is being clicked.
      return true;
    }
    return false;
  };

  const histogramBucketInfo = histogramData && parseHistogramBucketInfo(histogramData[0]);

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
        <DropdownMenu
          onOpen={onOpenMenu}
          onClose={onCloseMenu}
          shouldIgnoreClickOutside={shouldIgnoreMenuClose}
        >
          {({isOpen, getMenuProps, actions}) => {
            const onChartClick = bucket => {
              const htmlEvent = bucket.event.event;
              // Make a copy of the dims because echarts can remove elements after this click happens.
              // TODO(k-fish): Look at improving this to respond properly to resize events.
              const virtualRef = new VirtualReference(htmlEvent.target);
              setChartElement(virtualRef);

              const newTransactionEventView = eventView.clone();

              newTransactionEventView.fields = [{field: aggregateColumn}];
              const [_, tagValue] = bucket.value;

              if (histogramBucketInfo && histogramData) {
                const row = histogramData[bucket.dataIndex];
                const currentBucketStart = parseInt(
                  `${row[histogramBucketInfo.histogramField]}`,
                  10
                );
                const currentBucketEnd =
                  currentBucketStart + histogramBucketInfo.bucketSize;

                newTransactionEventView.additionalConditions.setTagValues(
                  aggregateColumn,
                  [`>=${currentBucketStart}`, `<${currentBucketEnd}`]
                );
              }

              newTransactionEventView.additionalConditions.setTagValues(tagKey, [
                tagValue,
              ]);

              setTransactionEventView(newTransactionEventView);
              trackTagPageInteraction(organization);

              if (!isMenuOpen) {
                actions.open();
              }
            };

            return (
              <React.Fragment>
                {ReactDOM.createPortal(
                  <div>
                    {chartElement ? (
                      <Popper referenceElement={chartElement} placement="bottom">
                        {({ref, style, placement}) => (
                          <StyledDropdownContainer
                            ref={ref}
                            style={style}
                            className="anchor-middle"
                            data-placement={placement}
                          >
                            <StyledDropdownContent
                              {...getMenuProps({
                                className: classNames('dropdown-menu'),
                              })}
                              isOpen={isOpen}
                              alignMenu="right"
                              blendCorner={false}
                            >
                              {transactionEventView ? (
                                <TagTransactionsQuery
                                  query={transactionEventView.getQueryWithAdditionalConditions()}
                                  location={location}
                                  eventView={transactionEventView}
                                  orgSlug={organization.slug}
                                  limit={4}
                                  referrer="api.performance.tag-page"
                                >
                                  {({
                                    isLoading: isTransactionsLoading,
                                    tableData: transactionTableData,
                                  }) => {
                                    const moreEventsTarget = isTransactionsLoading
                                      ? null
                                      : eventsRouteWithQuery({
                                          orgSlug: organization.slug,
                                          transaction: transactionName,
                                          projectID: decodeScalar(location.query.project),
                                          query: {
                                            ...transactionEventView.generateQueryStringObject(),
                                            query:
                                              transactionEventView.getQueryWithAdditionalConditions(),
                                          },
                                        });
                                    return (
                                      <React.Fragment>
                                        {isTransactionsLoading ? (
                                          <LoadingContainer>
                                            <LoadingIndicator size={40} hideMessage />
                                          </LoadingContainer>
                                        ) : (
                                          <div>
                                            {!transactionTableData.data.length ? (
                                              <Placeholder />
                                            ) : null}
                                            {[...transactionTableData.data]
                                              .slice(0, 3)
                                              .map(row => {
                                                const target = generateTransactionLink(
                                                  transactionName
                                                )(organization, row, location.query);

                                                return (
                                                  <DropdownItem
                                                    width="small"
                                                    key={row.id}
                                                    to={target}
                                                  >
                                                    <DropdownItemContainer>
                                                      <Truncate
                                                        value={row.id}
                                                        maxLength={12}
                                                      />
                                                      <SectionSubtext>
                                                        <PerformanceDuration
                                                          milliseconds={
                                                            row[aggregateColumn]
                                                          }
                                                          abbreviation
                                                        />
                                                      </SectionSubtext>
                                                    </DropdownItemContainer>
                                                  </DropdownItem>
                                                );
                                              })}
                                            {moreEventsTarget &&
                                            transactionTableData.data.length > 3 ? (
                                              <DropdownItem
                                                width="small"
                                                to={moreEventsTarget}
                                              >
                                                <DropdownItemContainer>
                                                  {t('View all events')}
                                                </DropdownItemContainer>
                                              </DropdownItem>
                                            ) : null}
                                          </div>
                                        )}
                                      </React.Fragment>
                                    );
                                  }}
                                </TagTransactionsQuery>
                              ) : null}
                            </StyledDropdownContent>
                          </StyledDropdownContainer>
                        )}
                      </Popper>
                    ) : null}
                  </div>,
                  getPortal()
                )}

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
              </React.Fragment>
            );
          }}
        </DropdownMenu>
      </TransitionChart>
    </StyledPanel>
  );
};

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

const StyledDropdownContainer = styled(DropdownContainer)`
  z-index: ${p => p.theme.zIndex.dropdown};
`;

const StyledDropdownContent = styled(Content)`
  right: auto;
  transform: translate(-50%);

  overflow: visible;
`;

const StyledPanel = styled(Panel)`
  padding: ${space(3)} ${space(3)} 0 ${space(3)};
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
`;

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)``;

export default withTheme(TagsHeatMap);
