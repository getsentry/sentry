import {useMemo} from 'react';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {NewQuery} from 'sentry/types/organization';
import {useDiscoverQuery, type TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseTraceTelemetryOptions {
  enabled: boolean;
  traceIds: string[];
}

interface TraceTelemetryData {
  errorsCount: number;
  logsCount: number;
  spansCount: number;
  trace: string;
}

interface TraceTelemetryResult {
  data: Map<string, TraceTelemetryData>;
  isLoading: boolean;
}

export function useTraceTelemetry({
  enabled,
  traceIds,
}: UseTraceTelemetryOptions): TraceTelemetryResult {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  // Query for error count
  const errorsEventView = useMemo(() => {
    const traceFilter = new MutableSearch('').addFilterValueList('trace', traceIds);
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Error Count',
      fields: ['trace', 'count()'],
      orderby: '-count',
      query: traceFilter.formatString(),
      version: 2,
      dataset: DiscoverDatasets.ERRORS,
    };
    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [traceIds, selection]);

  const errorsResult = useDiscoverQuery({
    eventView: errorsEventView,
    limit: traceIds.length,
    referrer: 'api.explore.trace-errors-count',
    orgSlug: organization.slug,
    location,
    options: {
      enabled: enabled && errorsEventView !== null,
    },
  });

  // Query for spans count
  const spansEventView = useMemo(() => {
    const traceFilter = new MutableSearch('').addFilterValueList('trace', traceIds);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Trace Spans Count',
      fields: ['trace', 'count(span.duration)'],
      orderby: '-count_span_duration',
      query: traceFilter.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [traceIds, selection]);

  const spansResult = useSpansQuery({
    enabled: enabled && spansEventView !== null,
    eventView: spansEventView,
    initialData: [],
    limit: traceIds.length,
    referrer: 'api.explore.trace-spans-count',
    trackResponseAnalytics: false,
  });

  // Query for logs count
  const logsEventView = useMemo(() => {
    const traceFilter = new MutableSearch('').addFilterValueList('trace', traceIds);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Trace Logs Count',
      fields: ['trace', 'count(message)'],
      orderby: '-count_message',
      query: traceFilter.formatString(),
      version: 2,
      dataset: DiscoverDatasets.OURLOGS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [traceIds, selection]);

  const logsResult = useSpansQuery({
    enabled: enabled && logsEventView !== null,
    eventView: logsEventView,
    initialData: [],
    limit: traceIds.length,
    referrer: 'api.explore.trace-logs-count',
    trackResponseAnalytics: false,
  });

  const telemetryData = useMemo(() => {
    const dataMap = new Map<string, TraceTelemetryData>();

    // Initialize with all trace IDs
    traceIds.forEach(traceId => {
      dataMap.set(traceId, {
        trace: traceId,
        spansCount: 0,
        logsCount: 0,
        errorsCount: 0,
      });
    });

    // Populate spans count
    if (spansResult.data) {
      spansResult.data.forEach((row: any) => {
        const traceId = row.trace as string;
        const count = row['count(span.duration)'] as number;
        if (dataMap.has(traceId)) {
          dataMap.get(traceId)!.spansCount = count;
        }
      });
    }

    // Populate logs count
    if (logsResult.data) {
      logsResult.data.forEach((row: any) => {
        const traceId = row.trace as string;
        const count = row['count(message)'] as number;
        if (dataMap.has(traceId)) {
          dataMap.get(traceId)!.logsCount = count;
        }
      });
    }

    // Populate errors count
    if (errorsResult.data) {
      errorsResult.data.data.forEach((row: TableDataRow) => {
        const traceId = row.trace as string;
        const count = row['count()'] as number;
        if (dataMap.has(traceId)) {
          dataMap.get(traceId)!.errorsCount = count;
        }
      });
    }

    return dataMap;
  }, [traceIds, spansResult.data, logsResult.data, errorsResult.data]);

  return {
    data: telemetryData,
    isLoading: spansResult.isPending || logsResult.isPending || errorsResult.isPending,
  };
}
