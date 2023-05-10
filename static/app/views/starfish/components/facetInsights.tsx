import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Placeholder from 'sentry/components/placeholder';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TAG_EXPLORER_COLUMN_ORDER} from 'sentry/views/performance/transactionSummary/transactionOverview/tagExplorer';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {TextAlignLeft} from 'sentry/views/starfish/modules/APIModule/endpointTable';

type Props = {
  eventView: EventView;
};

type DataRow = {
  count: number;
  // p50: Series;
  tagKey: string;
  tagValue: string;
  throughput: Series;
  tpmCorrelation: string;
};

const COLUMN_ORDER = [
  {
    key: 'tagKey',
    name: 'Key',
    width: 300,
  },
  {
    key: 'tagValue',
    name: 'Value',
    width: 300,
  },
  {
    key: 'count',
    name: 'count',
    width: 200,
  },
  {
    key: 'throughput',
    name: 'tpm',
    width: 200,
  },
  {
    key: 'tpmCorrelation',
    name: 'tpm correlation',
    width: 200,
  },
];

function transformSeries(name, data): Series {
  return {
    seriesName: name,
    data: data.map(datum => {
      return {name: datum[0], value: datum[1][0].count};
    }),
  };
}

export function FacetInsights({eventView}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const facetStatsEventView = eventView.clone();
  facetStatsEventView.fields = TAG_EXPLORER_COLUMN_ORDER;
  const sortedFacetStatsEventView = facetStatsEventView.withSorts([
    {
      field: 'sumdelta',
      kind: 'desc',
    },
  ]);

  const {isLoading, data} = useGenericDiscoverQuery<any, DiscoverQueryProps>({
    route: 'events-facets-stats',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...sortedFacetStatsEventView.getEventsAPIPayload(location),
      aggregateColumn: 'transaction.duration',
    }),
  });

  if (isLoading) {
    return <Placeholder height="400px" />;
  }

  const transformedData: DataRow[] = [];

  const totals = data?.totals;
  const keys = Object.keys(totals);
  for (let index = 0; index < keys.length; index++) {
    const element = keys[index];
    transformedData.push({
      tagKey: element.split(',')[0],
      tagValue: element.split(',')[1],
      count: totals[element].count,
      throughput: transformSeries('throughput', data![element]['count()'].data),
      tpmCorrelation: categorizeCorrelation(totals[element].sum_correlation),
    });
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={transformedData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      location={location}
      grid={{
        renderBodyCell: (column: GridColumnHeader, row: DataRow) =>
          renderBodyCell(column, row),
      }}
    />
  );
}

function renderBodyCell(column: GridColumnHeader, row: DataRow): React.ReactNode {
  if (column.key === 'throughput') {
    return (
      <Sparkline
        color={CHART_PALETTE[3][0]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
      />
    );
  }

  return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
}
function categorizeCorrelation(correlation: number): string {
  if (correlation >= 0.8) {
    return 'very high correlation';
  }
  if (correlation >= 0.6) {
    return 'high correlation';
  }
  if (correlation >= 0.4) {
    return 'medium correlation';
  }
  return 'no/low correlation';
}
