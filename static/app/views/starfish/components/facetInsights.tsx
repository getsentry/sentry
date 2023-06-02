import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {
  OverflowEllipsisTextContainer,
  TextAlignLeft,
} from 'sentry/views/starfish/components/textAlign';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

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

type Keys = 'tagKey' | 'tagValue' | 'p95' | 'throughput' | 'tpmCorrelation';
type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
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
    key: 'p95',
    name: DataTitles.p95,
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

  function renderBodyCell(column: TableColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'throughput' || column.key === 'p95') {
      return (
        <Sparkline
          color={column.key === 'throughput' ? CHART_PALETTE[3][0] : P95_COLOR}
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
    return null;
  }

  const transformedData: DataRow[] = [];

  const totals = data?.totals;
  const keys = Object.keys(totals);
  let showCorrelation = false;
  for (let index = 0; index < keys.length; index++) {
    const element = keys[index];
    const tpmCorrelation = categorizeCorrelation(totals[element].sum_correlation);
    if (tpmCorrelation !== NO_CORRELATION) {
      showCorrelation = true;
      transformedData.push({
        tagKey: element.split(',')[0],
        tagValue: element.split(',')[1],
        throughput: transformSeries('throughput', data![element]['count()'].data),
        p50: transformSeries('p50', data![element]['p75(transaction.duration)'].data),
        tpmCorrelation,
      });
    }
  }

  if (showCorrelation === false) {
    return null;
  }

  return (
    <Fragment>
      <SubHeader>{t('Correlations')}</SubHeader>
      <GridEditable
        isLoading={isLoading}
        data={transformedData}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        location={location}
        grid={{
          renderBodyCell: (column: TableColumnHeader, row: DataRow) =>
            renderBodyCell(column, row),
        }}
      />
    </Fragment>
  );
}

const NO_CORRELATION = 'no/low correlation';

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
  return NO_CORRELATION;
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
  margin-bottom: ${space(1)};
`;
