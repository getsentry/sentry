import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {DomainCell} from 'sentry/views/insights/http/components/tables/domainCell';
import {ModuleName, type SpanMetricsResponse} from 'sentry/views/insights/types';

type Row = Pick<
  SpanMetricsResponse,
  | 'project'
  | 'project.id'
  | 'span.domain'
  | 'spm()'
  | 'http_response_rate(3)'
  | 'http_response_rate(4)'
  | 'http_response_rate(5)'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  | 'span.domain'
  | 'project'
  | 'spm()'
  | 'http_response_rate(3)'
  | 'http_response_rate(4)'
  | 'http_response_rate(5)'
  | 'avg(span.self_time)'
  | 'time_spent_percentage()'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'span.domain',
    name: t('Domain'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `http_response_rate(3)`,
    name: t('3XXs'),
    width: 50,
  },
  {
    key: `http_response_rate(4)`,
    name: t('4XXs'),
    width: 50,
  },
  {
    key: `http_response_rate(5)`,
    name: t('5XXs'),
    width: 50,
  },
  {
    key: `avg(span.self_time)`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage()',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  'avg(span.self_time)',
  'spm()',
  'http_response_rate(3)',
  'http_response_rate(4)',
  'http_response_rate(5)',
  'time_spent_percentage()',
] as const;

type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
    error?: Error | null;
    meta?: EventsMetaType;
    pageLinks?: string;
  };
  sort: ValidSort;
}

export function DomainsTable({response, sort}: Props) {
  const {data, isLoading, meta, pageLinks} = response;
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.DOMAINS_CURSOR]: newCursor},
    });
  };

  return (
    <VisuallyCompleteWithData
      id="DomainsTable"
      hasData={data.length > 0}
      isLoading={isLoading}
    >
      <GridEditable
        aria-label={t('Domains')}
        isLoading={isLoading}
        error={response.error}
        data={data}
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
              sortParameterName: QueryParameterNames.DOMAINS_SORT,
            }),
          renderBodyCell: (column, row) =>
            renderBodyCell(column, row, meta, location, organization),
        }}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={handleCursor}
        paginationAnalyticsEvent={(direction: string) => {
          trackAnalytics('insight.general.table_paginate', {
            organization,
            source: ModuleName.HTTP,
            direction,
          });
        }}
      />
    </VisuallyCompleteWithData>
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === 'span.domain') {
    return (
      <DomainCell projectId={row['project.id']?.toString()} domain={row['span.domain']} />
    );
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  return renderer(
    {
      'span.op': 'http.client',
      ...row,
    },
    {
      location,
      organization,
      unit: meta.units?.[column.key],
    }
  );
}
