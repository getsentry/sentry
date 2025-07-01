import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
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
import {SpanDescriptionCell} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import type {SpanMetricsResponse} from 'sentry/views/insights/types';
import {ModuleName} from 'sentry/views/insights/types';

type Row = Pick<
  SpanMetricsResponse,
  | 'project.id'
  | 'sentry.normalized_description'
  | 'span.group'
  | 'span.action'
  | 'epm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
>;

type Column = GridColumnHeader<
  | 'sentry.normalized_description'
  | 'epm()'
  | 'avg(span.self_time)'
  | 'sum(span.self_time)'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'sentry.normalized_description',
    name: t('Query Description'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'epm()',
    name: `${t('Queries')} ${RATE_UNIT_TITLE[RateUnit.PER_MINUTE]}`,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(span.self_time)`,
    name: DataTitles.avg,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum(span.self_time)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = ['avg(span.self_time)', 'epm()', 'sum(span.self_time)'];

type ValidSort = Sort & {
  field: 'epm()' | 'avg(span.self_time)' | 'sum(span.self_time)';
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
  system?: string;
}

export function QueriesTable({response, sort, system}: Props) {
  const {data, isLoading, meta, pageLinks} = response;
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
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
              sortParameterName: QueryParameterNames.SPANS_SORT,
            }),
          renderBodyCell: (column, row) =>
            renderBodyCell(column, row, meta, location, organization, theme, system),
        }}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={handleCursor}
        paginationAnalyticsEvent={(direction: string) => {
          trackAnalytics('insight.general.table_paginate', {
            organization,
            source: ModuleName.DB,
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
  organization: Organization,
  theme: Theme,
  system?: string
) {
  if (column.key === 'sentry.normalized_description') {
    return (
      <SpanDescriptionCell
        moduleName={ModuleName.DB}
        description={row['sentry.normalized_description']}
        group={row['span.group']}
        projectId={row['project.id']}
        system={system}
        spanAction={row['span.action']}
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
    theme,
  });

  return rendered;
}
