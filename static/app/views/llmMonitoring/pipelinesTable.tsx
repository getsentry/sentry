import styled from '@emotion/styled';
import type {Location} from 'history';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import type {SpanMetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Row = Pick<
  SpanMetricsResponse,
  | 'project.id'
  | 'span.description'
  | 'span.group'
  | 'spm()'
  | 'avg(span.duration)'
  | 'sum(span.duration)'
  | 'ai_total_tokens_used()'
  | 'ai_total_tokens_used(c:spans/ai.total_cost@usd)'
>;

type Column = GridColumnHeader<
  | 'span.description'
  | 'spm()'
  | 'avg(span.duration)'
  | 'ai_total_tokens_used()'
  | 'ai_total_tokens_used(c:spans/ai.total_cost@usd)'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'span.description',
    name: t('AI Pipeline Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'ai_total_tokens_used()',
    name: t('Total tokens used'),
    width: 180,
  },
  {
    key: 'ai_total_tokens_used(c:spans/ai.total_cost@usd)',
    name: t('Total cost'),
    width: 180,
  },
  {
    key: `avg(span.duration)`,
    name: t('Pipeline Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Pipeline runs')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = ['ai_total_tokens_used()', 'avg(span.duration)', 'spm()'];

type ValidSort = Sort & {
  field: 'spm()' | 'avg(span.duration)';
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

export function PipelinesTable() {
  const location = useLocation();
  const moduleURL = useModuleURL('ai');

  const organization = useOrganization();
  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);
  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);
  const spanDescription = decodeScalar(location.query?.['span.description'], '');

  let sort = decodeSorts(sortField).filter(isAValidSort)[0];
  if (!sort) {
    sort = {field: 'spm()', kind: 'desc'};
  }

  const {data, isLoading, meta, pageLinks, error} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({
        'span.category': 'ai.pipeline',
        'span.description': spanDescription ? `*${spanDescription}*` : undefined,
      }),
      fields: [
        'project.id',
        'span.group',
        'span.description',
        'spm()',
        'avg(span.duration)',
        'sum(span.duration)',
      ],
      sorts: [sort],
      limit: 25,
      cursor,
    },
    'api.ai-pipelines.view'
  );

  const {data: tokensUsedData, isLoading: tokensUsedLoading} = useSpanMetrics(
    {
      search: new MutableSearch(
        `span.category:ai span.ai.pipeline.group:[${(data as Row[])?.map(x => x['span.group']).join(',')}]`
      ),
      fields: [
        'span.ai.pipeline.group',
        'ai_total_tokens_used()',
        'ai_total_tokens_used(c:spans/ai.total_cost@usd)',
      ],
    },
    'api.performance.ai-analytics.token-usage-chart'
  );

  const rows: Row[] = (data as Row[]).map(baseRow => {
    const row: Row = {
      ...baseRow,
      'ai_total_tokens_used()': 0,
      'ai_total_tokens_used(c:spans/ai.total_cost@usd)': 0,
    };
    if (!tokensUsedLoading) {
      const tokenUsedDataPoint = tokensUsedData.find(
        tokenRow => tokenRow['span.ai.pipeline.group'] === row['span.group']
      );
      if (tokenUsedDataPoint) {
        row['ai_total_tokens_used()'] = tokenUsedDataPoint['ai_total_tokens_used()'];
        row['ai_total_tokens_used(c:spans/ai.total_cost@usd)'] =
          tokenUsedDataPoint['ai_total_tokens_used(c:spans/ai.total_cost@usd)'];
      }
    }
    return row;
  });

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: newCursor},
    });
  };

  const handleSearch = (newQuery: string) => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        'span.description': newQuery === '' ? undefined : newQuery,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  return (
    <VisuallyCompleteWithData
      id="PipelinesTable"
      hasData={rows.length > 0}
      isLoading={isLoading}
    >
      <Container>
        <SearchBar
          placeholder={t('Search for pipeline')}
          query={spanDescription}
          onSearch={handleSearch}
        />
        <GridEditable
          isLoading={isLoading}
          error={error}
          data={rows}
          columnOrder={COLUMN_ORDER}
          columnSortBy={[
            {
              key: sort.field,
              order: sort.kind,
            },
          ]}
          grid={{
            renderHeadCell: column =>
              renderHeadCell({
                column,
                sort,
                location,
                sortParameterName: QueryParameterNames.SPANS_SORT,
              }),
            renderBodyCell: (column, row) =>
              renderBodyCell(moduleURL, column, row, meta, location, organization),
          }}
          location={location}
        />
        <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
      </Container>
    </VisuallyCompleteWithData>
  );
}

function renderBodyCell(
  moduleURL: string,
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === 'span.description') {
    if (!row['span.description']) {
      return <span>(unknown)</span>;
    }
    if (!row['span.group']) {
      return <span>{row['span.description']}</span>;
    }

    const queryString = {
      ...location.query,
      'span.description': row['span.description'],
    };

    return (
      <Link
        to={`${moduleURL}/pipeline-type/${row['span.group']}?${qs.stringify(queryString)}`}
      >
        {row['span.description']}
      </Link>
    );
  }
  if (column.key === 'ai_total_tokens_used(c:spans/ai.total_cost@usd)') {
    const cost = row['ai_total_tokens_used(c:spans/ai.total_cost@usd)'];
    if (cost) {
      return <span>US ${cost.toFixed(3)}</span>;
    }
    return (
      <span>
        Unknown{' '}
        <Tooltip
          title="Cost can only be calculated for certain OpenAI and Anthropic models, other providers aren't yet supported."
          isHoverable
        >
          <IconInfo size="xs" />
        </Tooltip>
      </span>
    );
  }

  if (!meta || !meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  const rendered = renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });

  return rendered;
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
