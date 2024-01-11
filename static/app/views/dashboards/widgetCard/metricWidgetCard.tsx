import {Fragment, memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {DataZoomComponentOption, LegendComponentOption} from 'echarts';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {IconLightning, IconReleases, IconSettings, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {
  MetricMeta,
  MRI,
  Organization,
  PageFilters,
  SavedSearchType,
  TagCollection,
} from 'sentry/types';
import {EChartEventHandler, Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  getReadableMetricType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isTransactionDuration,
  MetricDisplayType,
  MetricsQuery,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {AugmentedEChartDataZoomHandler} from 'sentry/views/dashboards/widgetCard/chart';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {GenericWidgetQueriesChildrenProps} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {MetricWidgetBody} from 'sentry/views/ddm/widget';

import {
  formatMRI,
  getUseCaseFromMRI,
  parseField,
  parseMRI,
} from '../../../utils/metrics/mri';
import {DashboardFilters, Widget} from '../types';

type Props = Pick<
  GenericWidgetQueriesChildrenProps,
  'timeseriesResults' | 'tableResults' | 'errorMessage' | 'loading'
> & {
  location: Location;
  organization: Organization;
  router: any;
  selection: PageFilters;
  widget: Widget;
  chartZoomOptions?: DataZoomComponentOption;
  dashboardFilters?: DashboardFilters;
  expandNumbers?: boolean;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  noPadding?: boolean;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    totalIssuesCount?: string;
  }) => void;
  onEdit?: (index: string) => void;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onUpdate?: (widget: Widget) => void;
  onZoom?: AugmentedEChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showSlider?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function MetricWidgetCardAdapter({
  // api,
  organization,
  selection,
  widget,
  // isMobile,
  // renderErrorMessage,
  // tableItemLimit,
  // windowWidth,
  // noLazyLoad,
  // showStoredAlert,
  // noDashboardsMEPProvider,
  // dashboardFilters,
  // isWidgetInvalid,
  isEditingWidget,
  onEdit,
  onUpdate,
  location,
  router,
  index,
}: Props) {
  // const datasetConfig = getDatasetConfig(WidgetType.ISSUE);

  const query = widget.queries[0];

  const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>({
      mri: parsed.mri,
      op: parsed.op,
      query: query.conditions,
      groupBy: query.columns,
      title: widget.title,
      displayType: widget.displayType as any as MetricDisplayType,
    });

  const handleChange = useCallback((data: Partial<MetricWidgetQueryParams>) => {
    setMetricWidgetQueryParams(curr => ({
      ...curr,
      ...data,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      widget.displayType as any as MetricDisplayType
    );

    const updatedWidget = {
      ...widget,
      queries: convertedWidget.queries,
    };

    onUpdate?.(updatedWidget);
  }, [metricWidgetQueryParams, onUpdate, widget, selection]);

  if (!parsed) {
    return (
      <ErrorPanel height="200px">
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          <WidgetHeaderDescription>
            <WidgetTitleRow>
              <QueryBuilder
                size="sm"
                isEdit={!!isEditingWidget}
                displayType={widget.displayType as any as MetricDisplayType}
                metricsQuery={metricWidgetQueryParams}
                projects={selection.projects}
                powerUserMode={false}
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
              {/* <WidgetTitle>a</WidgetTitle> */}
            </WidgetTitleRow>
          </WidgetHeaderDescription>
          <ContextMenuWrapper>
            <WidgetCardContextMenu
              organization={organization}
              widget={widget}
              selection={selection}
              showContextMenu
              isPreview={false}
              widgetLimitReached={false}
              onEdit={() => index && onEdit?.(index)}
              router={router}
              location={location}
              // index={index}
              // seriesData={seriesData}
              // seriesResultsType={seriesResultsType}
              // tableData={tableData}
              // pageLinks={pageLinks}
              // totalIssuesCount={totalIssuesCount}
            />
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>

        <MetricWidgetBody
          widgetIndex={0}
          addFocusArea={() => {}}
          removeFocusArea={() => {}}
          focusArea={null}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
          onChange={() => {}}
          mri={metricWidgetQueryParams.mri}
          op={metricWidgetQueryParams.op}
          query={metricWidgetQueryParams.query}
          groupBy={metricWidgetQueryParams.groupBy}
          displayType={metricWidgetQueryParams.displayType as any as MetricDisplayType}
        />
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

// const LoadingPlaceholder = styled(Placeholder)`
//   background-color: ${p => p.theme.surface300};
// `;

// const StyledSimpleTableChart = styled(SimpleTableChart)`
//   margin-top: ${space(1.5)};
//   border-bottom-left-radius: ${p => p.theme.borderRadius};
//   border-bottom-right-radius: ${p => p.theme.borderRadius};
//   font-size: ${p => p.theme.fontSizeMedium};
//   box-shadow: none;
// `;

// const WidgetTitle = styled(HeaderTitle)`
//   ${p => p.theme.overflowEllipsis};
//   font-weight: normal;
// `;

const WidgetHeaderWrapper = styled('div')`
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const ContextMenuWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
`;

const WidgetHeaderDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

import * as Sentry from '@sentry/react';
import memoize from 'lodash/memoize';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {BooleanOperator} from 'sentry/components/searchSyntax/parser';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import {convertToDashboardWidget} from '../../../utils/metrics/dashboard';

type QueryBuilderProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  // TODO(ddm): move display type out of the query builder
  metricsQuery: MetricsQuerySubject;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  onSubmit: () => void;
  projects: number[];
  powerUserMode?: boolean;
  size?: 'sm' | 'xs';
};

const isShownByDefault = (metric: MetricMeta) =>
  isMeasurement(metric) || isCustomMetric(metric) || isTransactionDuration(metric);

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects,
  displayType,
  onChange,
  onSubmit,
  isEdit,
  size = 'sm',
}: QueryBuilderProps) {
  const {data: meta, isLoading: isMetaLoading} = useMetricsMeta(projects);
  const router = useRouter();

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, projects);

  const displayedMetrics = useMemo(() => {
    const isSelected = (metric: MetricMeta) => metric.mri === metricsQuery.mri;
    return meta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));
  }, [meta, metricsQuery.mri]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  // Reset the query data if the selected metric is no longer available
  useEffect(() => {
    if (
      metricsQuery.mri &&
      !isMetaLoading &&
      !displayedMetrics.find(metric => metric.mri === metricsQuery.mri)
    ) {
      onChange({mri: '' as MRI, op: '', groupBy: []});
    }
  }, [isMetaLoading, displayedMetrics, metricsQuery.mri, onChange]);

  const stringifiedMetricWidget = stringifyMetricWidget(metricsQuery);

  const readableType = getReadableMetricType(parseMRI(metricsQuery.mri)?.type);

  if (!isEdit) {
    return (
      <QueryBuilderWrapper>
        <WidgetTitleQB>
          <TextOverflow>{metricsQuery.title || stringifiedMetricWidget}</TextOverflow>
        </WidgetTitleQB>
      </QueryBuilderWrapper>
    );
  }

  return (
    <QueryBuilderWrapper>
      <QueryBuilderRow>
        <WrapPageFilterBar>
          <CompactSelect
            searchable
            sizeLimit={100}
            triggerProps={{prefix: t('Metric'), size}}
            options={displayedMetrics.map(metric => ({
              label: formatMRI(metric.mri),
              // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
              textValue: `${metric.mri}${getReadableMetricType(metric.type)}`,
              value: metric.mri,
              size,
              trailingItems: ({isFocused}) => (
                <Fragment>
                  {isFocused && isCustomMetric({mri: metric.mri}) && (
                    <Button
                      borderless
                      size="zero"
                      icon={<IconSettings />}
                      aria-label={t('Metric Settings')}
                      onPointerDown={() => {
                        // not using onClick to beat the dropdown listener
                        navigateTo(
                          `/settings/projects/:projectId/metrics/${encodeURIComponent(
                            metric.mri
                          )}`,
                          router
                        );
                      }}
                    />
                  )}

                  <Tag tooltipText={t('Type')}>{getReadableMetricType(metric.type)}</Tag>
                  <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
                </Fragment>
              ),
            }))}
            value={metricsQuery.mri}
            onChange={option => {
              const availableOps =
                meta
                  .find(metric => metric.mri === option.value)
                  ?.operations.filter(isAllowedOp) ?? [];

              // @ts-expect-error .op is an operation
              const selectedOp = availableOps.includes(metricsQuery.op ?? '')
                ? metricsQuery.op
                : availableOps?.[0];
              Sentry.metrics.increment('ddm.widget.metric', 1, {
                tags: {
                  display: displayType,
                  type: readableType,
                  operation: selectedOp,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                mri: option.value,
                op: selectedOp,
                groupBy: undefined,
                focusedSeries: undefined,
                displayType: getWidgetDisplayType(option.value, selectedOp),
              });
            }}
          />
          <CompactSelect
            size={size}
            triggerProps={{prefix: t('Op'), size}}
            options={
              selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op}
            onChange={option => {
              Sentry.metrics.increment('ddm.widget.operation', 1, {
                tags: {
                  display: displayType,
                  type: readableType,
                  operation: option.value,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                op: option.value,
              });
            }}
          />
          <CompactSelect
            multiple
            triggerProps={{prefix: t('Group by'), size}}
            options={tags.map(tag => ({
              label: tag.key,
              value: tag.key,
              trailingItems: (
                <Fragment>
                  {tag.key === 'release' && <IconReleases size="xs" />}
                  {tag.key === 'transaction' && <IconLightning size="xs" />}
                </Fragment>
              ),
            }))}
            disabled={!metricsQuery.mri}
            value={metricsQuery.groupBy}
            onChange={options => {
              Sentry.metrics.increment('ddm.widget.group', 1, {
                tags: {
                  display: displayType,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                groupBy: options.map(o => o.value),
                focusedSeries: undefined,
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Display'), size}}
            value={displayType}
            options={[
              {
                value: MetricDisplayType.LINE,
                label: t('Line'),
              },
              {
                value: MetricDisplayType.AREA,
                label: t('Area'),
              },
              {
                value: MetricDisplayType.BAR,
                label: t('Bar'),
              },
            ]}
            onChange={({value}) => {
              Sentry.metrics.increment('ddm.widget.display', 1, {
                tags: {
                  display: value,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({displayType: value});
            }}
          />
        </WrapPageFilterBar>
      </QueryBuilderRow>
      {/* Stop propagation so widget does not get selected immediately */}
      <QueryBuilderRow onClick={stopPropagation}>
        <MetricSearchBar
          // TODO(aknaus): clean up projectId type in ddm
          projectIds={projects.map(id => id.toString())}
          mri={metricsQuery.mri}
          disabled={!metricsQuery.mri}
          onChange={query => {
            Sentry.metrics.increment('ddm.widget.filter', 1, {
              tags: {
                display: displayType,
                type: readableType,
                operation: metricsQuery.op,
                isGrouped: !!metricsQuery.groupBy?.length,
                isFiltered: !!query,
              },
            });
            onChange({query});
          }}
          query={metricsQuery.query}
        />
      </QueryBuilderRow>
      <Button size="sm" priority="primary" onClick={onSubmit}>
        {t('Apply')}
      </Button>
    </QueryBuilderWrapper>
  );
});

interface MetricSearchBarProps extends Partial<SmartSearchBarProps> {
  onChange: (value: string) => void;
  projectIds: string[];
  disabled?: boolean;
  mri?: MRI;
  query?: string;
}

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();
const DISSALLOWED_LOGICAL_OPERATORS = new Set([BooleanOperator.OR]);

export function MetricSearchBar({
  mri,
  disabled,
  onChange,
  query,
  projectIds,
  ...props
}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const projectIdNumbers = useMemo(
    () => projectIds.map(id => parseInt(id, 10)),
    [projectIds]
  );

  const {data: tags = EMPTY_ARRAY, isLoading} = useMetricsTags(mri, projectIdNumbers);

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  const fetchTagValues = useMemo(() => {
    const fn = memoize((tagKey: string) => {
      // clear response from cache after 10 seconds
      setTimeout(() => {
        fn.cache.delete(tagKey);
      }, 10000);
      return api.requestPromise(`/organizations/${org.slug}/metrics/tags/${tagKey}/`, {
        query: {
          metric: mri,
          useCase: getUseCaseFromMRI(mri),
          project: selection.projects,
        },
      });
    });
    return fn;
  }, [api, mri, org.slug, selection.projects]);

  const getTagValues = useCallback(
    async (tag: any, search: string) => {
      const tagsValues = await fetchTagValues(tag.key);

      return tagsValues
        .filter(
          tv =>
            tv.value !== '' &&
            tv.value.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        )
        .map(tv => tv.value);
    },
    [fetchTagValues]
  );

  const handleChange = useCallback(
    (value: string, {validSearch} = {validSearch: true}) => {
      if (validSearch) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <WideSearchBar
      disabled={disabled}
      maxMenuHeight={220}
      organization={org}
      onGetTagValues={getTagValues}
      supportedTags={supportedTags}
      // don't highlight tags while loading as we don't know yet if they are supported
      highlightUnsupportedTags={!isLoading}
      disallowedLogicalOperators={DISSALLOWED_LOGICAL_OPERATORS}
      disallowFreeText
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
      query={query}
      savedSearchType={SavedSearchType.METRIC}
      durationKeys={EMPTY_SET}
      percentageKeys={EMPTY_SET}
      numericKeys={EMPTY_SET}
      dateKeys={EMPTY_SET}
      booleanKeys={EMPTY_SET}
      sizeKeys={EMPTY_SET}
      textOperatorKeys={EMPTY_SET}
      {...props}
    />
  );
}

function getWidgetDisplayType(
  mri: MetricsQuery['mri'],
  op: MetricsQuery['op']
): MetricDisplayType {
  if (mri?.startsWith('c') || op === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
`;

const QueryBuilderRow = styled('div')`
  padding: ${space(1)};
  padding-bottom: 0;
`;

const WideSearchBar = styled(SmartSearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;

const WrapPageFilterBar = styled(PageFilterBar)`
  max-width: max-content;
  height: auto;
  flex-wrap: wrap;
`;

const WidgetTitleQB = styled(HeaderTitle)`
  padding-left: ${space(2)};
  padding-top: ${space(2)};
  padding-right: ${space(1)};
`;
