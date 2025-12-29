import type {Client, ResponseMeta} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, QueryFieldValue} from 'sentry/utils/discover/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {BuildDetailsArtifactType} from 'sentry/views/preprod/types/buildDetailsTypes';

import type {DatasetConfig} from './base';
import {handleOrderByReset} from './base';

export interface AppSizeResponse {
  data: Array<[number, Array<{count: number | null}>]>;
  end: number;
  meta: {
    fields: Record<string, string>;
  };
  start: number;
}

const ARTIFACT_TYPE_LABELS: Record<BuildDetailsArtifactType, string> = {
  [BuildDetailsArtifactType.XCARCHIVE]: 'xcarchive',
  [BuildDetailsArtifactType.AAB]: 'aab',
  [BuildDetailsArtifactType.APK]: 'apk',
};

// Note: Query building is handled by custom logic in getSeriesRequest.
// This serves as the initial template for new widgets.
const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [],
  columns: [],
  fieldAliases: [],
  aggregates: [],
  conditions: '',
  orderby: '',
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
  getTableFieldOptions: () => ({}),
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

    let field = 'max(max_install_size)';
    if (widgetQuery.conditions) {
      const condParams = new URLSearchParams(widgetQuery.conditions);
      const sizeType = condParams.get('size_type');
      if (sizeType === 'download') {
        field = 'max(max_download_size)';
      }
    }

    const {start, end, period} = pageFilters.datetime;
    const baseParams: Record<string, any> = {
      project: pageFilters.projects,
      environment: pageFilters.environments,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
      statsPeriod: period || (!start && !end ? '14d' : undefined),
      interval: widget.interval || '1d',
      field,
    };

    if (widgetQuery.conditions) {
      const params = new URLSearchParams(widgetQuery.conditions);
      params.forEach((value, key) => {
        // Skip size_type - it's client-side only to determine which field to use
        if (value && key !== 'size_type') {
          baseParams[key] = value;
        }
      });
    }

    return api
      .requestPromise(`/organizations/${organization.slug}/preprod/app-size-stats/`, {
        method: 'GET',
        query: baseParams,
      })
      .then(response => [[response], undefined, undefined]);
  },
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    return data;
  },
  transformSeries: (
    data: AppSizeResponse[],
    widgetQuery: WidgetQuery,
    _organization: Organization
  ): Series[] => {
    let appId = '';
    let branch = '';
    let buildConfig = '';
    let artifactType = '';
    let sizeType = 'install';

    if (widgetQuery.conditions) {
      const params = new URLSearchParams(widgetQuery.conditions);
      appId = params.get('app_id') ?? '';
      branch = params.get('git_head_ref') ?? '';
      buildConfig = params.get('build_configuration_name') ?? '';
      artifactType = params.get('artifact_type') ?? '';
      sizeType = params.get('size_type') ?? 'install';
    }

    return data.map(response => {
      // Filter out time buckets with no data, creating a continuous line
      const seriesData = response.data
        .filter(
          ([, values]) => values[0]?.count !== null && values[0]?.count !== undefined
        )
        .map(([timestamp, values]) => ({
          name: timestamp * 1000,
          value: values[0]!.count as number,
        }));

      const parts: string[] = [];
      if (appId) {
        parts.push(appId);
      }
      if (artifactType) {
        const artifactTypeNum = Number(artifactType) as BuildDetailsArtifactType;
        if (artifactTypeNum in ARTIFACT_TYPE_LABELS) {
          parts.push(ARTIFACT_TYPE_LABELS[artifactTypeNum]);
        }
      }
      if (branch) {
        parts.push(branch);
      }
      if (buildConfig) {
        parts.push(buildConfig);
      }

      const aggregate =
        sizeType === 'download' ? 'max(max_download_size)' : 'max(max_install_size)';
      const baseLabel = parts.length > 0 ? parts.join(' : ') : 'App Size';
      const seriesName = `${baseLabel} : ${aggregate}`;

      return {
        seriesName,
        data: seriesData,
      };
    });
  },
  getSeriesResultType: (
    _data: AppSizeResponse[],
    _widgetQuery: WidgetQuery
  ): Record<string, AggregationOutputType> => {
    // Register both possible aggregates as size_base10 to handle multi-query widgets
    // where different queries may use different size types (install vs download)
    return {
      'max(max_install_size)': 'size_base10',
      'max(max_download_size)': 'size_base10',
    };
  },
  handleOrderByReset,
};
