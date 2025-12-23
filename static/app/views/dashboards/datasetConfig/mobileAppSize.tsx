import type {Client, ResponseMeta} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, QueryFieldValue} from 'sentry/utils/discover/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {DatasetConfig} from './base';
import {handleOrderByReset} from './base';

interface AppSizeResponse {
  data: Array<[number, Array<{count: number | null}>]>;
  end: number;
  meta: {
    fields: Record<string, string>;
  };
  start: number;
}

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['max(max_install_size)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['max(max_install_size)'],
  conditions: '',
  orderby: '-max(max_install_size)',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['max', 'max_install_size', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export const MobileAppSizeConfig: DatasetConfig<AppSizeResponse[], TableData> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: EventsSearchBar,
  supportedDisplayTypes: [DisplayType.LINE],
  getTableFieldOptions: (
    organization: Organization,
    _tags?: TagCollection,
    _customMeasurements?: CustomMeasurementCollection
  ) => {
    return generateFieldOptions({
      organization,
      tagKeys: [],
      fieldKeys: [
        'min_install_size',
        'max_install_size',
        'min_download_size',
        'max_download_size',
      ],
      aggregations: {
        max: {
          isSortable: true,
          outputType: 'size_base10',
          parameters: [
            {
              kind: 'column',
              columnTypes: ['number'],
              defaultValue: 'max_install_size',
              required: true,
            },
          ],
        },
        min: {
          isSortable: true,
          outputType: 'size_base10',
          parameters: [
            {
              kind: 'column',
              columnTypes: ['number'],
              defaultValue: 'max_install_size',
              required: true,
            },
          ],
        },
        avg: {
          isSortable: true,
          outputType: 'size_base10',
          parameters: [
            {
              kind: 'column',
              columnTypes: ['number'],
              defaultValue: 'max_install_size',
              required: true,
            },
          ],
        },
      },
    });
  },
  getSeriesRequest: (
    api: Client,
    widget: Widget,
    queryIndex: number,
    organization: Organization,
    pageFilters: PageFilters,
    _onDemandControlContext?: OnDemandControlContext,
    _referrer?: string,
    _mepSetting?: MEPState | null,
    _samplingMode?: SamplingMode
  ): Promise<[AppSizeResponse[], string | undefined, ResponseMeta | undefined]> => {
    const widgetQuery = widget.queries[queryIndex];
    if (!widgetQuery) {
      return Promise.reject(new Error('No widget query found'));
    }

    const {start, end, period} = pageFilters.datetime;
    const baseParams: Record<string, any> = {
      project: pageFilters.projects,
      environment: pageFilters.environments,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
      statsPeriod: period || (!start && !end ? '14d' : undefined),
      interval: widget.interval || '1d',
      field: widgetQuery.aggregates[0] || 'max(max_install_size)',
    };

    // Parse conditions string into separate filter parameters
    if (widgetQuery.conditions) {
      const params = new URLSearchParams(widgetQuery.conditions);

      params.forEach((value, key) => {
        if (value) {
          baseParams[key] = value;
        }
      });
    }

    return api
      .requestPromise(`/organizations/${organization.slug}/preprod/app-size-stats/`, {
        method: 'GET',
        query: baseParams,
      })
      .then(response => [[response as AppSizeResponse], undefined, undefined]);
  },
  getTableRequest: (
    api: Client,
    widget: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    _onDemandControlContext?: OnDemandControlContext,
    _limit?: number,
    _cursor?: string,
    _referrer?: string,
    _mepSetting?: MEPState | null,
    _samplingMode?: SamplingMode
  ): Promise<[TableData, string | undefined, ResponseMeta | undefined]> => {
    // For table display, we use the same API but return all data points
    const {start, end, period} = pageFilters.datetime;
    const baseParams: Record<string, any> = {
      project: pageFilters.projects,
      environment: pageFilters.environments,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
      statsPeriod: period || (!start && !end ? '14d' : undefined),
      interval: widget.interval || '1d',
      field: query.aggregates[0] || 'max(max_install_size)',
    };

    // Parse conditions
    if (query.conditions) {
      const params = new URLSearchParams(query.conditions);

      // Add all filter parameters to baseParams
      params.forEach((value, key) => {
        if (value) {
          baseParams[key] = value;
        }
      });
    }

    return api
      .requestPromise(`/organizations/${organization.slug}/preprod/app-size-stats/`, {
        method: 'GET',
        query: baseParams,
      })
      .then((response: AppSizeResponse) => {
        const aggregate = query.aggregates[0] || 'value';
        const data = response.data.map(([timestamp, values], idx) => ({
          id: String(idx),
          timestamp,
          [aggregate]: values[0]?.count ?? 0,
        }));
        return [
          {
            data,
            meta: response.meta,
          },
          undefined,
          undefined,
        ];
      });
  },
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    // Data is already in the correct format from getTableRequest
    return data;
  },
  transformSeries: (
    data: AppSizeResponse[],
    widgetQuery: WidgetQuery,
    _organization: Organization
  ): Series[] => {
    // Parse conditions to extract app_id for series name
    let appId = '';
    let branch = '';
    let buildConfig = '';
    let artifactType = '';

    if (widgetQuery.conditions) {
      const params = new URLSearchParams(widgetQuery.conditions);
      appId = params.get('app_id') ?? '';
      branch = params.get('git_head_ref') ?? '';
      buildConfig = params.get('build_configuration_name') ?? '';
      artifactType = params.get('artifact_type') ?? '';
    }

    return data.map(response => {
      // Filter out time buckets with no data, creating a continuous line
      const seriesData = response.data
        .filter(([, values]) => values[0]?.count !== null)
        .map(([timestamp, values]) => ({
          name: timestamp * 1000, // Convert to milliseconds
          value: values[0]!.count as number,
        }));

      // Build series name
      const parts: string[] = [];

      // Map artifact type number to readable label
      const artifactTypeLabels: Record<string, string> = {
        '0': 'xcarchive',
        '1': 'aab',
        '2': 'apk',
      };

      if (appId) {
        parts.push(appId);
      }
      if (artifactType) {
        const label = artifactTypeLabels[artifactType];
        if (label) {
          parts.push(label);
        }
      }
      if (branch) {
        parts.push(branch);
      }
      if (buildConfig) {
        parts.push(buildConfig);
      }

      const displayLabel = parts.length > 0 ? parts.join(' : ') : 'App Size';
      const aggregate = widgetQuery.aggregates[0] || 'value';
      const seriesName = `${displayLabel} : ${aggregate}`;

      return {
        seriesName,
        data: seriesData,
      };
    });
  },
  getSeriesResultType: (
    _data: AppSizeResponse[],
    widgetQuery: WidgetQuery
  ): Record<string, AggregationOutputType> => {
    const types: Record<string, AggregationOutputType> = {};
    const aggregate = widgetQuery.aggregates[0];
    if (aggregate) {
      types[aggregate] = 'size_base10';
    }
    return types;
  },
  handleOrderByReset,
};
