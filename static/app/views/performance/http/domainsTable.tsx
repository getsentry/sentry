import {browserHistory} from 'react-router';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {RATE_UNIT_TITLE, RateUnit} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DomainCell} from 'sentry/views/performance/http/domainCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import type {MetricsResponse} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = Pick<
  MetricsResponse,
  | 'project.id'
  | 'span.domain'
  | 'spm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  'span.domain' | 'spm()' | 'avg(span.self_time)' | 'time_spent_percentage()'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'span.domain',
    name: t('Domain'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Requests')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
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
  const location = useLocation();
  const organization = useOrganization();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
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
        location={location}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
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
    return <DomainCell domain={row['span.domain']} />;
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });
}
