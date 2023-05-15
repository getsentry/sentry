import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TAG_EXPLORER_COLUMN_ORDER} from 'sentry/views/performance/transactionSummary/transactionOverview/tagExplorer';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {
  OverflowEllipsisTextContainer,
  TextAlignLeft,
} from 'sentry/views/starfish/modules/APIModule/endpointTable';

type Props = {
  eventView: EventView;
};

type DataRow = {
  p50: Series;
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
    width: 200,
  },
  {
    key: 'p50',
    name: 'p50(duration)',
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

  function renderBodyCell(column: GridColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'throughput' || column.key === 'p50') {
      return (
        <Sparkline
          color={column.key === 'throughput' ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1]}
          series={row[column.key]}
          width={column.width ? column.width - column.width / 5 : undefined}
        />
      );
    }

    if (column.key === 'tagValue') {
      const query = new MutableSearch(eventView.query);
      let queryFilter = '';
      query.tokens.forEach(value => {
        if (value.key) {
          queryFilter = queryFilter.concat(' ', `${value.key}:${value.value}`);
        }
      });
      queryFilter = queryFilter.concat(' ', `${row.tagKey}:${row.tagValue}`);
      return (
        <OverflowEllipsisTextContainer>
          <Link
            to={`/discover/homepage/?${qs.stringify({
              ...eventView.generateQueryStringObject(),
              query: queryFilter,
              field: [
                'title',
                'p50(transaction.duration)',
                'p75(transaction.duration)',
                'p95(transaction.duration)',
              ],
              yAxis: 'count()',
            })}`}
          >
            {row[column.key]}
          </Link>
        </OverflowEllipsisTextContainer>
      );
    }

    return <TextAlignLeft>{row[column.key]}</TextAlignLeft>;
  }

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
      throughput: transformSeries('throughput', data![element]['count()'].data),
      p50: transformSeries('p50', data![element]['p75(transaction.duration)'].data),
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

function categorizeCorrelation(correlation: number): string {
  if (correlation >= 0.8) {
    return 'very highly correlated';
  }
  if (correlation >= 0.6) {
    return 'highly correlated';
  }
  if (correlation >= 0.4) {
    return 'correlated';
  }
  return 'no/low correlation';
}
