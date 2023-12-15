import {browserHistory} from 'react-router';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {RATE_UNIT_TITLE, RateUnits} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanDescriptionCell} from 'sentry/views/starfish/components/tableCells/spanDescriptionCell';
import {MetricsResponse, ModuleName} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Row = Pick<
  MetricsResponse,
  | 'project.id'
  | 'span.description'
  | 'span.group'
  | 'spm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
  | 'time_spent_percentage()'
>;

type Column = GridColumnHeader<
  'span.description' | 'spm()' | 'avg(span.self_time)' | 'time_spent_percentage()'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'span.description',
    name: t('Query Description'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: `${t('Queries')} ${RATE_UNIT_TITLE[RateUnits.PER_MINUTE]}`,
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

const SORTABLE_FIELDS = ['avg(span.self_time)', 'spm()', 'time_spent_percentage()'];

type ValidSort = Sort & {
  field: 'spm()' | 'avg(span.self_time)' | 'time_spent_percentage()';
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
    meta?: EventsMetaType;
    pageLinks?: string;
  };
  sort: ValidSort;
}

export function QueriesTable({response, sort}: Props) {
  const {data, isLoading, meta, pageLinks} = response;
  const location = useLocation();
  const organization = useOrganization();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: newCursor},
    });
  };

  return (
    <VisuallyCompleteWithData
      id="QueriesTable"
      hasData={data.length > 0}
      isLoading={isLoading}
    >
      <GridEditable
        isLoading={isLoading}
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
              sortParameterName: QueryParameterNames.SPANS_SORT,
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
  if (column.key === 'span.description') {
    return (
      <SpanDescriptionCell
        moduleName={ModuleName.DB}
        description={row['span.description']}
        group={row['span.group']}
        projectId={row['project.id']}
      />
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
