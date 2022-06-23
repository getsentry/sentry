import {useCallback, useContext, useEffect, useState} from 'react';

import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';

import {getDatasetConfig} from '../datasetConfig/base';
import {DEFAULT_TABLE_LIMIT, DisplayType, Widget} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';
import {getIsMetricsDataFromSeriesResponse} from './widgetQueries';

type ChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  totalCount?: string;
};

export type GenericWidgetQueriesProps = {
  api: Client;
  children: (props: ChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (props: any) => void;
};

function getReferrer(displayType: DisplayType) {
  let referrer: string = '';

  if (displayType === DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else if (displayType === DisplayType.WORLD_MAP) {
    referrer = 'api.dashboards.worldmapwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

function GenericWidgetQueries({
  api,
  children,
  cursor,
  limit,
  onDataFetched,
  organization,
  selection,
  widget,
}: GenericWidgetQueriesProps) {
  const config = getDatasetConfig(widget.widgetType);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<ChildrenProps['errorMessage']>(undefined);
  const [pageLinks, setPageLinks] = useState<ChildrenProps['pageLinks']>(undefined);
  const [tableResults, setTableResults] =
    useState<ChildrenProps['tableResults']>(undefined);
  const [timeseriesResults, setTimeseriesResults] =
    useState<ChildrenProps['timeseriesResults']>(undefined);
  const dashboardMEPContext = useContext(DashboardsMEPContext);

  const fetchTableData = useCallback(
    async function fetchTableData(isMounted: boolean) {
      const responses: [TableData | EventsTableData, string, ResponseMeta][] =
        await Promise.all(
          widget.queries.map(query => {
            let requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
            let requestCreator = config.getTableRequest;
            if (widget.displayType === DisplayType.WORLD_MAP) {
              requestLimit = undefined;
              requestCreator = config.getWorldMapRequest;
            }
            return requestCreator!(
              api,
              query,
              organization,
              selection,
              requestLimit,
              cursor,
              getReferrer(widget.displayType)
            );
          })
        );

      // transform the data
      let transformedTableResults: TableDataWithTitle[] = [];
      let isMetricsData: boolean | undefined;
      let responsePageLinks: string | null = null;
      responses.forEach(([data, _textstatus, resp], i) => {
        // If one of the queries is sampled, then mark the whole thing as sampled
        isMetricsData = isMetricsData === false ? false : data.meta?.isMetricsData;
        dashboardMEPContext?.setIsMetricsData(isMetricsData);

        // Cast so we can add the title.
        const transformedData = config.transformTable(
          // TODO: Types across configs are &'d here. Should be |'d or set to a specific type
          // @ts-ignore
          data,
          widget.queries[0],
          organization,
          selection
        ) as TableDataWithTitle;
        transformedData.title = widget.queries[i]?.name ?? '';

        // Overwrite the local var to work around state being stale in tests.
        transformedTableResults = [...transformedTableResults, transformedData];
        responsePageLinks = resp?.getResponseHeader('Link');
      });

      if (!isMounted) {
        return;
      }

      onDataFetched?.({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks ?? undefined,
      });
      setTableResults(transformedTableResults);
      setPageLinks(responsePageLinks);
    },
    [
      api,
      config,
      cursor,
      dashboardMEPContext,
      limit,
      onDataFetched,
      organization,
      selection,
      widget,
    ]
  );

  const fetchSeriesData = useCallback(
    async function fetchSeriesData(isMounted: boolean) {
      const responses = await Promise.all(
        widget.queries.map((_query, index) => {
          return config.getSeriesRequest!(
            api,
            widget,
            index,
            organization,
            selection,
            getReferrer(widget.displayType)
          );
        })
      );
      let isMetricsData: boolean | undefined;
      const transformedTimeseriesResults: Series[] = [];
      responses.forEach((rawResults, requestIndex) => {
        // If one of the queries is sampled, then mark the whole thing as sampled
        isMetricsData =
          isMetricsData === false
            ? false
            : getIsMetricsDataFromSeriesResponse(rawResults);
        dashboardMEPContext?.setIsMetricsData(isMetricsData);
        const transformedResult = config.transformSeries!(
          // @ts-ignore
          rawResults,
          widget.queries[requestIndex],
          organization
        );
        // When charting timeseriesData on echarts, color association to a timeseries result
        // is order sensitive, ie series at index i on the timeseries array will use color at
        // index i on the color array. This means that on multi series results, we need to make
        // sure that the order of series in our results do not change between fetches to avoid
        // coloring inconsistencies between renders.
        transformedResult.forEach((result, resultIndex) => {
          transformedTimeseriesResults[
            requestIndex * transformedResult.length + resultIndex
          ] = result;
        });
      });

      if (!isMounted) {
        return;
      }

      onDataFetched?.({timeseriesResults: transformedTimeseriesResults});
      setTimeseriesResults(transformedTimeseriesResults);
    },
    [
      api,
      config.getSeriesRequest,
      config.transformSeries,
      dashboardMEPContext,
      onDataFetched,
      organization,
      selection,
      widget,
    ]
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setTableResults(undefined);
      setTimeseriesResults(undefined);

      try {
        if (
          [DisplayType.TABLE, DisplayType.BIG_NUMBER, DisplayType.WORLD_MAP].includes(
            widget.displayType
          )
        ) {
          await fetchTableData(isMounted);
        } else {
          await fetchSeriesData(isMounted);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err?.responseJSON?.detail || t('An unknown error occurred.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    let isMounted = true;
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [fetchSeriesData, fetchTableData, widget.displayType]);

  return children({loading, tableResults, timeseriesResults, errorMessage, pageLinks});
}

export default GenericWidgetQueries;
