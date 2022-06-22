import {useEffect, useState} from 'react';

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

type ChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  totalCount?: string;
};

type Props = {
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

function WidgetQueries({
  api,
  children,
  cursor,
  limit,
  onDataFetched,
  organization,
  selection,
  widget,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<ChildrenProps['errorMessage']>(undefined);
  const [tableResults, setTableResults] =
    useState<ChildrenProps['tableResults']>(undefined);
  const [timeseriesResults, setTimeseriesResults] =
    useState<ChildrenProps['timeseriesResults']>(undefined);

  const config = getDatasetConfig(widget.widgetType);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setTableResults(undefined);
      setTimeseriesResults(undefined);

      let responses: [TableData | EventsTableData, string, ResponseMeta][];
      try {
        responses = await Promise.all(
          widget.queries.map(query => {
            // TODO: Support the other display types
            return config.getTableRequest!(
              api,
              query,
              organization,
              selection,
              limit ?? DEFAULT_TABLE_LIMIT,
              cursor,
              getReferrer(widget.displayType)
            );
          })
        );

        // transform the data
        let transformedTableResults: TableDataWithTitle[] = [];
        let isMetricsData: boolean | undefined;
        let pageLinks: string | null = null;
        responses.forEach(([data, _textstatus, resp], i) => {
          // If one of the queries is sampled, then mark the whole thing as sampled
          isMetricsData = isMetricsData === false ? false : data.meta?.isMetricsData;

          // Cast so we can add the title.
          const transformedData = config.transformTable(
            // TODO: Types across configs are &'d here. Should be |'d or set to a specific type
            data,
            widget.queries[0],
            organization,
            selection
          ) as TableDataWithTitle;
          transformedData.title = widget.queries[i]?.name ?? '';

          // Overwrite the local var to work around state being stale in tests.
          transformedTableResults = [...transformedTableResults, transformedData];
          pageLinks = resp?.getResponseHeader('Link');
        });
        onDataFetched?.({
          tableResults: transformedTableResults,
          pageLinks: pageLinks ?? undefined,
        });
        setTableResults(transformedTableResults);
      } catch (err) {
        setErrorMessage(err?.responseJSON?.detail || t('An unknown error occurred.'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [
    widget.queries,
    widget.widgetType,
    widget.displayType,
    onDataFetched,
    config,
    api,
    organization,
    selection,
    limit,
    cursor,
  ]);

  return children({loading, tableResults, timeseriesResults, errorMessage});
}

export default WidgetQueries;
