import {Fragment, useMemo} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import type {EventData} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useDataset} from 'sentry/views/explore/hooks/useDataset';
import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';
import {useSorts} from 'sentry/views/explore/hooks/useSorts';
import {useUserQuery} from 'sentry/views/explore/hooks/useUserQuery';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceMetadataHeader';

interface SpansTableProps {}

export function SpansTable({}: SpansTableProps) {
  const {selection} = usePageFilters();

  const [dataset] = useDataset();
  const [fields] = useSampleFields();
  const [sorts] = useSorts({fields});
  const [query] = useUserQuery();

  const eventView = useMemo(() => {
    const queryFields = [
      ...fields,
      'project',
      'trace',
      'transaction.id',
      'span_id',
      'timestamp',
    ];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sorts.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, sorts, query, selection]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-samples-table',
  });

  const {tableStyles} = useTableStyles({
    items: fields.map(field => {
      return {
        label: field,
        value: field,
      };
    }),
  });

  const meta = result.meta ?? {};

  return (
    <Fragment>
      <Table style={tableStyles}>
        <TableHead>
          <TableRow>
            {fields.map((field, i) => (
              <TableHeadCell key={i} isFirst={i === 0}>
                {field}
              </TableHeadCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : result.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {fields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <Field
                        dataset={dataset}
                        data={row}
                        field={field}
                        unit={meta?.units?.[field]}
                        meta={fields}
                      />
                    </TableBodyCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}

interface FieldProps {
  data: EventData;
  dataset: DiscoverDatasets;
  field: string;
  meta: string[];
  unit?: string;
}

function Field({data, dataset, field, meta, unit}: FieldProps) {
  const location = useLocation();
  const organization = useOrganization();

  const renderer = getFieldRenderer(field, meta, false);

  let rendered = renderer(data, {
    location,
    organization,
    unit,
  });

  if (field === 'id' || field === 'span_id') {
    const target = generateLinkToEventInTraceView({
      projectSlug: data.project,
      traceSlug: data.trace,
      timestamp: data.timestamp,
      eventId:
        dataset === DiscoverDatasets.SPANS_INDEXED ? data['transaction.id'] : undefined,
      organization,
      location,
      spanId: data.span_id,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  return <Fragment>{rendered}</Fragment>;
}
