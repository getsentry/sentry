import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {OverChartButtonGroup} from 'sentry/views/explore/components/overChartButtonGroup';
import SchemaHintsList, {
  SchemaHintsSection,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {
  BottomSectionBody,
  FilterBarContainer,
  LogsGraphContainer,
  LogsItemContainer,
  LogsSidebarCollapseButton,
  LogsTableActionsContainer,
  StyledPageFilterBar,
  TableActionsContainer,
  ToolbarAndBodyContainer,
  ToolbarContainer,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {METRIC_TYPES} from 'sentry/views/explore/metrics/constants';
import {
  isMetricsDashboardsEnabled,
  isMetricsSaveAsQueryEnabled,
} from 'sentry/views/explore/metrics/isMetricsEnabled';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricsGraph';
import {MetricsTab} from 'sentry/views/explore/metrics/metricsTab';
import {MetricsToolbar} from 'sentry/views/explore/metrics/metricsToolbar';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {useMetricsSearchQueryBuilderProps} from 'sentry/views/explore/metrics/useMetricsSearchQueryBuilderProps';
import {useMetricsTimeSeries} from 'sentry/views/explore/metrics/useMetricsTimeSeries';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsSearch,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsGroupBys,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {PickableDays} from 'sentry/views/explore/utils';

type MetricsTabContentProps = PickableDays;

interface MetricNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function MetricNameInput({value, onChange, placeholder}: MetricNameInputProps) {
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Array<{label: string; value: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getTraceItemAttributeValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
  });

  // Create a Tag object for the metric_name field
  const metricNameTag: Tag = useMemo(
    () => ({
      key: TraceMetricKnownFieldKey.METRIC_NAME,
      name: TraceMetricKnownFieldKey.METRIC_NAME,
    }),
    []
  );

  // Fetch metric name values when search changes
  useEffect(() => {
    const fetchOptions = async () => {
      if (!searchValue.trim()) {
        setOptions([]);
        return;
      }

      setIsLoading(true);
      try {
        const values = await getTraceItemAttributeValues(metricNameTag, searchValue);
        const newOptions = values.map(val => ({
          label: val,
          value: val,
        }));
        setOptions(newOptions);
      } catch (error) {
        console.error('Failed to fetch metric name values:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchOptions, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchValue, getTraceItemAttributeValues, metricNameTag]);

  return (
    <CompactSelect
      searchable
      searchPlaceholder={placeholder || t('Search metric names...')}
      value={value}
      options={options}
      onChange={option => onChange(typeof option.value === 'string' ? option.value : '')}
      onSearch={setSearchValue}
      loading={isLoading}
      triggerProps={{
        'aria-label': t('Metric Name'),
        style: {minWidth: '200px'},
      }}
      triggerLabel={value || placeholder || t('Metric Name')}
    />
  );
}

interface GroupByDropdownProps {
  groupBys: readonly string[];
  setGroupBys: (groupBys: string[]) => void;
  stringAttributes: TagCollection;
  numberAttributes: TagCollection;
}

function GroupByDropdown({
  groupBys,
  setGroupBys,
  stringAttributes,
  numberAttributes,
}: GroupByDropdownProps) {
  const options = useMemo(
    () =>
      [
        {
          label: t('None'),
          value: '',
          textValue: t('None'),
        },
        ...Object.keys(numberAttributes ?? {}).map(key => ({
          label: prettifyTagKey(key),
          value: key,
          textValue: key,
          trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={key}
              kind={FieldKind.MEASUREMENT}
              label={key}
              traceItemType={TraceItemDataset.TRACEMETRICS}
            />
          ),
        })),
        ...Object.keys(stringAttributes ?? {}).map(key => ({
          label: prettifyTagKey(key),
          value: key,
          textValue: key,
          trailingItems: <TypeBadge kind={FieldKind.TAG} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={key}
              kind={FieldKind.TAG}
              label={key}
              traceItemType={TraceItemDataset.TRACEMETRICS}
            />
          ),
        })),
      ].toSorted((a, b) => {
        const aLabel = prettifyTagKey(a.value);
        const bLabel = prettifyTagKey(b.value);
        if (aLabel < bLabel) {
          return -1;
        }
        if (aLabel > bLabel) {
          return 1;
        }
        return 0;
      }),
    [numberAttributes, stringAttributes]
  );

  const currentValue = groupBys.length > 0 ? groupBys[0] : '';
  const currentOption = options.find(opt => opt.value === currentValue);

  return (
    <CompactSelect
      options={options}
      value={currentValue}
      onChange={option => {
        if (typeof option.value === 'string') {
          setGroupBys(option.value ? [option.value] : []);
        }
      }}
      triggerLabel={currentOption?.label || t('Group By')}
      searchable
      triggerProps={{
        'aria-label': t('Group By'),
        style: {minWidth: '120px'},
      }}
    />
  );
}

export function MetricsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: MetricsTabContentProps) {
  const organization = useOrganization();
  const _metricsSearch = useQueryParamsSearch();
  const metricsSearch = _metricsSearch || new MutableSearch('');
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const mode = useQueryParamsMode();
  const setMode = useSetQueryParamsMode();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const visualizes = useQueryParamsVisualizes();

  const [metricName, setMetricName] = useState('');
  const [metricType, setMetricType] = useState<
    'counter' | 'gauge' | 'distribution' | 'set'
  >('counter');
  const [sidebarOpen, setSidebarOpen] = useState(mode === Mode.AGGREGATE);

  const columnEditorButtonRef = useRef<HTMLButtonElement>(null);
  // always use the smallest interval possible (the most bars)
  const [interval] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!aggregateSortBys.length) {
      return undefined;
    }

    return aggregateSortBys.map(formatSort);
  }, [aggregateSortBys]);

  // Add metric filters to search
  const search = useMemo(() => {
    const newSearch = new MutableSearch(metricsSearch.formatString());

    // Add metric filters if they exist
    if (metricName.trim()) {
      newSearch.addFilterValue('metric_name', metricName.trim());
    }
    if (metricType) {
      newSearch.addFilterValue('metric_type', metricType);
    }

    return newSearch;
  }, [metricsSearch, metricName, metricType]);

  const yAxes = useMemo(() => {
    const uniqueYAxes = new Set(visualizes.map(visualize => visualize.yAxis));
    return [...uniqueYAxes];
  }, [visualizes]);

  const timeseriesResult = useMetricsTimeSeries(
    {
      search,
      yAxis: yAxes,
      interval,
      fields: [...groupBys.filter(Boolean), ...yAxes],
      topEvents: topEventsLimit,
      orderby,
    },
    'explore.metrics.main-chart'
  );

  const {
    attributes: stringAttributes,
    isLoading: stringAttributesLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceItemAttributes('string', []);
  const {
    attributes: numberAttributes,
    isLoading: numberAttributesLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceItemAttributes('number', []);

  const {tracesItemSearchQueryBuilderProps, searchQueryBuilderProviderProps} =
    useMetricsSearchQueryBuilderProps({
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
    });

  const supportedAggregates = useMemo(() => {
    return [];
  }, []);

  // Save as items for dropdown
  const saveAsItems = useMemo(() => {
    const items = [];
    if (isMetricsDashboardsEnabled(organization)) {
      items.push({
        key: 'dashboard',
        label: t('Dashboard Widget'),
        onAction: () => {
          // TODO: Implement dashboard save
        },
      });
    }
    if (isMetricsSaveAsQueryEnabled(organization)) {
      items.push({
        key: 'query',
        label: t('Saved Query'),
        onAction: () => {
          // TODO: Implement saved query
        },
      });
    }
    return items;
  }, [organization]);

  const tableTab = mode === Mode.AGGREGATE ? 'aggregates' : 'metrics';
  const setTableTab = useCallback(
    (tab: 'aggregates' | 'metrics') => {
      if (tab === 'aggregates') {
        setSidebarOpen(true);
        setMode(Mode.AGGREGATE);
      } else {
        setMode(Mode.SAMPLES);
      }
    },
    [setSidebarOpen, setMode]
  );

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <TopSectionBody noRowGap>
        <Layout.Main fullWidth>
          <FilterBarContainer>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={relativeOptions}
                searchPlaceholder={t('Custom range: 2h, 4d, 3w')}
              />
            </StyledPageFilterBar>
          </FilterBarContainer>
          <InputContainer>
            <MetricInputsRow>
              <MetricNameInput
                placeholder={t('Metric Name')}
                value={metricName}
                onChange={setMetricName}
              />
              <CompactSelect
                options={METRIC_TYPES as any}
                value={metricType}
                onChange={(opt: any) => setMetricType(opt.value)}
                triggerProps={{
                  'aria-label': t('Metric Type'),
                }}
              />
              {mode === Mode.AGGREGATE && (
                <GroupByDropdown
                  groupBys={groupBys}
                  setGroupBys={setGroupBys}
                  stringAttributes={stringAttributes}
                  numberAttributes={numberAttributes}
                />
              )}
            </MetricInputsRow>
            <TraceItemSearchQueryBuilder
              {...tracesItemSearchQueryBuilderProps}
              placeholder={t('Search for metric attributes')}
              searchSource={LogsAnalyticsPageSource.EXPLORE_METRICS}
            />
            {saveAsItems.length > 0 && (
              <DropdownMenu
                items={saveAsItems}
                trigger={triggerProps => (
                  <Button
                    {...triggerProps}
                    priority="default"
                    aria-label={t('Save as')}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();

                      triggerProps.onClick?.(e);
                    }}
                  >
                    {t('Save as')}
                  </Button>
                )}
              />
            )}
          </InputContainer>
          <StyledSchemaHintsSection>
            <StyledSchemaHintsList
              supportedAggregates={supportedAggregates}
              numberTags={numberAttributes}
              stringTags={stringAttributes}
              isLoading={numberAttributesLoading || stringAttributesLoading}
              exploreQuery={metricsSearch.formatString()}
              source={SchemaHintsSources.LOGS}
              searchBarWidthOffset={columnEditorButtonRef.current?.clientWidth}
            />
          </StyledSchemaHintsSection>
        </Layout.Main>
      </TopSectionBody>

      <ToolbarAndBodyContainer sidebarOpen={sidebarOpen}>
        {sidebarOpen && (
          <ToolbarContainer sidebarOpen={sidebarOpen}>
            <MetricsToolbar stringTags={stringAttributes} numberTags={numberAttributes} />
          </ToolbarContainer>
        )}
        <BottomSectionBody sidebarOpen={sidebarOpen}>
          <section>
            <OverChartButtonGroup>
              <LogsSidebarCollapseButton
                sidebarOpen={sidebarOpen}
                aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
                size="xs"
                icon={
                  <IconChevron
                    isDouble
                    direction={sidebarOpen ? 'left' : 'right'}
                    size="xs"
                  />
                }
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? null : t('Advanced')}
              </LogsSidebarCollapseButton>
            </OverChartButtonGroup>
            <LogsGraphContainer>
              <MetricsGraph timeseriesResult={timeseriesResult} />
            </LogsGraphContainer>
            <LogsTableActionsContainer>
              <Tabs value={tableTab} onChange={setTableTab} size="sm">
                <TabList hideBorder variant="floating">
                  <TabList.Item key={'metrics'}>{t('Metrics')}</TabList.Item>
                  <TabList.Item key={'aggregates'}>{t('Aggregates')}</TabList.Item>
                </TabList>
              </Tabs>
              <TableActionsContainer>
                {/* TODO: Add table actions */}
              </TableActionsContainer>
            </LogsTableActionsContainer>
            <LogsItemContainer>
              <MetricsTab />
            </LogsItemContainer>
          </section>
        </BottomSectionBody>
      </ToolbarAndBodyContainer>
    </SearchQueryBuilderProvider>
  );
}

const MetricInputsRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const InputContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledSchemaHintsList = styled(SchemaHintsList)`
  margin-top: ${space(1)};
  display: none;
`;

const StyledSchemaHintsSection = styled(SchemaHintsSection)`
  display: none;
`;
