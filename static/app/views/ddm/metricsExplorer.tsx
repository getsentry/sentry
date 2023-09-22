import {Fragment, useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import {CompactSelect} from 'sentry/components/compactSelect';
import EmptyMessage from 'sentry/components/emptyMessage';
import SearchBar from 'sentry/components/events/searchBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Tag from 'sentry/components/tag';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricsTag, TagCollection} from 'sentry/types';
import {
  defaultMetricDisplayType,
  formatMetricsUsingUnitAndOp,
  getNameFromMRI,
  getReadableMetricType,
  getUnitFromMRI,
  getUseCaseFromMri,
  MetricDisplayType,
  MetricsData,
  MetricsDataProps,
  useMetricsData,
  useMetricsMeta,
  useMetricsTags,
} from 'sentry/utils/metrics';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';

const useProjectSelectionSlugs = () => {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  return useMemo(
    () =>
      selection.projects
        .map(id => projects.find(p => p.id === id.toString())?.slug)
        .filter(Boolean) as string[],
    [projects, selection.projects]
  );
};

function MetricsExplorer() {
  const {selection} = usePageFilters();

  const slugs = useProjectSelectionSlugs();
  const router = useRouter();

  const [query, setQuery] = useState<QueryBuilderState>();

  return (
    <MetricsExplorerPanel>
      <PanelBody>
        <QueryBuilder setQuery={setQuery} />
        {query && (
          <MetricsExplorerDisplayOuter
            displayType={router.location.query.display ?? defaultMetricDisplayType}
            datetime={selection.datetime}
            projects={slugs}
            {...query}
          />
        )}
      </PanelBody>
    </MetricsExplorerPanel>
  );
}

type QueryBuilderProps = {
  setQuery: (query: QueryBuilderState) => void;
};

type QueryBuilderState = {
  groupBy: string[];
  mri: string;
  op: string;
  queryString: string;
};

type QueryBuilderAction =
  | {
      type: 'mri';
      value: string;
    }
  | {
      type: 'op';
      value: string;
    }
  | {
      type: 'groupBy';
      value: string[];
    }
  | {
      type: 'queryString';
      value: string;
    };

function QueryBuilder({setQuery}: QueryBuilderProps) {
  const meta = useMetricsMeta();
  const mriModeKeyPressed = useKeyPress('`', undefined, true);
  const [mriMode, setMriMode] = useState(false);

  useEffect(() => {
    if (mriModeKeyPressed) {
      setMriMode(!mriMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed]);

  const isAllowedOp = (op: string) =>
    !['max_timestamp', 'min_timestamp', 'histogram'].includes(op);

  const reducer = (state: QueryBuilderState, action: QueryBuilderAction) => {
    if (action.type === 'mri') {
      const availableOps = meta[`${action.value}`]?.operations.filter(isAllowedOp);
      const selectedOp = availableOps.includes(state.op) ? state.op : availableOps[0];
      return {...state, mri: action.value, op: selectedOp};
    }
    if (['op', 'groupBy', 'queryString'].includes(action.type)) {
      return {...state, [action.type]: action.value};
    }

    return state;
  };

  const [state, dispatch] = useReducer(reducer, {
    mri: '',
    op: '',
    queryString: '',
    groupBy: [],
  });

  const {data: tags = []} = useMetricsTags(state.mri);

  useEffect(() => {
    setQuery(state);
  }, [state, setQuery]);

  if (!meta) {
    return null;
  }

  const selectedMetric = meta[state.mri] || {operations: []};

  return (
    <QueryBuilderWrapper>
      <QueryBuilderRow>
        <PageFilterBar condensed>
          <CompactSelect
            searchable
            triggerProps={{prefix: t('Metric'), size: 'sm'}}
            options={Object.values(meta)
              .filter(metric => (mriMode ? true : metric.mri.includes(':custom/')))
              .map(metric => ({
                label: mriMode ? metric.mri : metric.name,
                value: metric.mri,
                trailingItems: mriMode ? undefined : (
                  <Fragment>
                    <Tag tooltipText={t('Type')}>
                      {getReadableMetricType(metric.type)}
                    </Tag>
                    <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
                  </Fragment>
                ),
              }))}
            value={state.mri}
            onChange={option => {
              dispatch({type: 'mri', value: option.value});
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Operation'), size: 'sm'}}
            options={selectedMetric.operations.filter(isAllowedOp).map(op => ({
              label: op,
              value: op,
            }))}
            value={state.op}
            onChange={option => dispatch({type: 'op', value: option.value})}
          />
          <CompactSelect
            multiple
            triggerProps={{prefix: t('Group by'), size: 'sm'}}
            options={tags.map(tag => ({
              label: tag.key,
              value: tag.key,
            }))}
            value={state.groupBy}
            onChange={options => {
              dispatch({type: 'groupBy', value: options.map(o => o.value)});
            }}
          />
        </PageFilterBar>
      </QueryBuilderRow>
      <QueryBuilderRow>
        <MetricSearchBar
          tags={tags}
          mri={state.mri}
          disabled={!state.mri}
          onChange={data => {
            dispatch({type: 'queryString', value: data});
          }}
        />
      </QueryBuilderRow>
    </QueryBuilderWrapper>
  );
}

type MetricSearchBarProps = {
  mri: string;
  onChange: (value: string) => void;
  tags: MetricsTag[];
  disabled?: boolean;
};

function MetricSearchBar({tags, mri, disabled, onChange}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  // TODO(ogi) try to use useApiQuery here
  const getTagValues = useCallback(
    async tag => {
      const tagsValues = await api.requestPromise(
        `/organizations/${org.slug}/metrics/tags/${tag.key}/`,
        {query: {useCase: getUseCaseFromMri(mri)}}
      );

      return tagsValues.map(tv => tv.value);
    },
    [api, mri, org.slug]
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
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
    />
  );
}

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const QueryBuilderRow = styled('div')`
  padding: ${space(1)};
  padding-bottom: 0;
`;

const WideSearchBar = styled(SearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;

type Group = {
  by: Record<string, unknown>;
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

type DisplayProps = MetricsDataProps & {
  displayType: MetricDisplayType;
};

function MetricsExplorerDisplayOuter(props?: DisplayProps) {
  if (!props?.mri) {
    return (
      <DisplayWrapper>
        <EmptyMessage
          icon={<IconSearch size="xxl" />}
          title={t('Nothing to show!')}
          description={t('Choose a metric to display data.')}
        />
      </DisplayWrapper>
    );
  }
  return <MetricsExplorerDisplay {...props} />;
}

function MetricsExplorerDisplay({displayType, ...metricsDataProps}: DisplayProps) {
  const {data, isLoading, isError} = useMetricsData(metricsDataProps);
  // TODO(ddm): maybe it is nicer to use a set here, or to keep state of shown series instead
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toggleSeriesVisibility = (seriesName: string) => {
    if (hiddenSeries.includes(seriesName)) {
      setHiddenSeries(hiddenSeries.filter(s => s !== seriesName));
    } else {
      setHiddenSeries([...hiddenSeries, seriesName]);
    }
  };

  if (!data) {
    return (
      <DisplayWrapper>
        {isLoading && <LoadingIndicator />}
        {isError && <Alert type="error">{t('Error while fetching metrics data')}</Alert>}
      </DisplayWrapper>
    );
  }

  // TODO(ddm): we should move this into the useMetricsData hook
  const sorted = sortData(data);
  const unit = getUnitFromMRI(Object.keys(data.groups[0]?.series ?? {})[0]); // this assumes that all series have the same unit

  const series = sorted.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getSeriesName(g, data.groups.length === 1),
    };
  });

  const colors = theme.charts.getColorPalette(series.length);

  const chartSeries = series.map((item, i) => ({
    seriesName: item.name,
    unit,
    color: colors[i],
    hidden: hiddenSeries.includes(item.name),
    data: item.values.map((value, index) => ({
      name: sorted.intervals[index],
      value,
    })),
  }));

  return (
    <DisplayWrapper>
      <Chart
        series={chartSeries}
        displayType={displayType}
        operation={metricsDataProps.op}
        {...normalizeChartTimeParams(sorted)}
      />
      <SummaryTable
        series={chartSeries}
        operation={metricsDataProps.op}
        onClick={toggleSeriesVisibility}
      />
    </DisplayWrapper>
  );
}

function getSeriesName(group: Group, isOnlyGroup = false) {
  if (isOnlyGroup) {
    return Object.keys(group.series)?.[0] ?? '(none)';
  }

  return Object.entries(group.by)
    .map(([key, value]) => `${key}:${String(value).length ? value : t('none')}`)
    .join(', ');
}

function sortData(data: MetricsData): MetricsData {
  if (!data.groups.length) {
    return data;
  }

  const key = Object.keys(data.groups[0].totals)[0];

  const sortedGroups = data.groups.sort((a, b) =>
    a.totals[key] < b.totals[key] ? 1 : -1
  );

  return {
    ...data,
    groups: sortedGroups,
  };
}

function normalizeChartTimeParams(data: MetricsData) {
  const {
    start,
    end,
    utc: utcString,
    statsPeriod,
  } = normalizeDateTimeParams(data, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
  });

  const utc = utcString === 'true';

  if (start && end) {
    return utc
      ? {
          start: moment.utc(start).format(),
          end: moment.utc(end).format(),
          utc,
        }
      : {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
          utc,
        };
  }

  return {
    period: statsPeriod ?? '90d',
  };
}

export type Series = {
  color: string;
  data: {name: string; value: number}[];
  seriesName: string;
  unit: string;
  hidden?: boolean;
};

type ChartProps = {
  displayType: MetricDisplayType;
  series: Series[];
  end?: string;
  operation?: string;
  period?: string;
  start?: string;
  utc?: boolean;
};

function Chart({series, displayType, start, end, period, utc, operation}: ChartProps) {
  const unit = series[0].unit;

  const seriesToShow = series.filter(s => !s.hidden);

  const chartProps = {
    isGroupedByDate: true,
    series: seriesToShow,
    height: 300,
    colors: seriesToShow.map(s => s.color),
    grid: {top: 20, bottom: 20, left: 20, right: 20},
    tooltip: {
      valueFormatter: (value: number) => {
        return formatMetricsUsingUnitAndOp(value, unit, operation);
      },
      nameFormatter: mri => getNameFromMRI(mri),
    },
    yAxis: {
      axisLabel: {
        formatter: (value: number) => {
          return formatMetricsUsingUnitAndOp(value, unit, operation);
        },
      },
    },
  };

  return (
    <Fragment>
      <ChartZoom period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps =>
          displayType === MetricDisplayType.LINE ? (
            <LineChart {...chartProps} {...zoomRenderProps} />
          ) : displayType === MetricDisplayType.AREA ? (
            <AreaChart {...chartProps} {...zoomRenderProps} />
          ) : (
            <BarChart stacked {...chartProps} {...zoomRenderProps} />
          )
        }
      </ChartZoom>
    </Fragment>
  );
}

const MetricsExplorerPanel = styled(Panel)`
  padding-bottom: 0;
`;

const DisplayWrapper = styled('div')`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export default MetricsExplorer;
