import {Fragment, useMemo} from 'react';

import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import type {NewQuery} from 'sentry/types/organization';
import type {EventData} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
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

  const queryFields = useMemo(() => {
    return [...fields, 'project', 'trace', 'transaction.id', 'span_id', 'timestamp'];
  }, [fields]);

  const eventView = useMemo(() => {
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
  }, [dataset, queryFields, sorts, query, selection]);

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
          {result.data?.map((row, i) => (
            <TableRow key={i}>
              {fields.map((field, j) => {
                return (
                  <TableBodyCell key={j}>
                    <Field
                      data={row}
                      field={field}
                      unit={meta?.units?.[field]}
                      meta={fields}
                    />
                  </TableBodyCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination pageLinks={result.pageLinks} />
    </Fragment>
  );
}

interface FieldProps {
  data: EventData;
  field: string;
  meta: string[];
  unit?: string;
}

function Field({data, field, meta, unit}: FieldProps) {
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
      eventId: data['transaction.id'],
      organization,
      location,
      spanId: data.span_id,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  return <Fragment>{rendered}</Fragment>;
}
