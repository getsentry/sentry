import {Fragment} from 'react';
import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  fromSorts,
  isFieldSortable,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {TableColumn} from 'sentry/views/discover/table/types';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} =
  SpanMetricsField;

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function ScreenLoadSpansTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const routingContext = useRoutingContext();
  const router = useRouter();

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    'span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]',
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const sort = fromSorts(
    decodeScalar(location.query[QueryParameterNames.SPANS_SORT])
  )[0] ?? {
    kind: 'desc',
    field: 'count()',
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
      `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
      'count()',
      'time_spent_percentage()',
      `sum(${SPAN_SELF_TIME})`,
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
  });

  const eventViewColumns = eventView.getColumns();

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    'count()': DataTitles.count,
    'time_spent_percentage()': DataTitles.timeSpent,
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Avg Duration (Release 1)'
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Avg Duration  (Release 2)'
    ),
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = `${routingContext.baseURL}/pageload/spans`;
      const query = {
        ...location.query,
        transaction,
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <Link
          to={`${pathname}?${qs.stringify(query)}`}
          onClick={() => {
            router.replace({
              pathname,
              query,
            });
          }}
        >
          <Truncate value={label} maxLength={75} />
        </Link>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];
    const alignment = fieldAlignment(column.key as string, fieldType);
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: newSort},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const columnSortBy = eventView.getSorts();

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={eventViewColumns
          .filter(
            (col: TableColumn<React.ReactText>) =>
              col.name !== PROJECT_ID &&
              col.name !== SPAN_GROUP &&
              col.name !== `sum(${SPAN_SELF_TIME})`
          )
          .map((col: TableColumn<React.ReactText>) => {
            return {...col, name: columnNameMap[col.key]};
          })}
        columnSortBy={columnSortBy}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}
