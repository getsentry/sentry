import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {ALLOWED_CELL_ACTIONS} from '../components/table';
import {useUserQuery} from '../hooks/useUserQuery';

interface FieldProps {
  column: TableColumn<keyof TableDataRow>;
  data: EventData;
  meta: MetaType;
  unit?: string;
}

export function FieldRenderer({data, meta, unit, column}: FieldProps) {
  const location = useLocation();
  const organization = useOrganization();
  const [userQuery, setUserQuery] = useUserQuery();
  const dateSelection = EventView.fromLocation(location).normalizeDateSelection(location);
  const query = new MutableSearch(userQuery);
  const field = column.name;

  const renderer = getFieldRenderer(field, meta, false);

  let rendered = renderer(data, {
    location,
    organization,
    unit,
  });

  if (field === 'timestamp') {
    const date = new Date(data.timestamp);
    rendered = <StyledTimeSince unitStyle="extraShort" date={date} tooltipShowSeconds />;
  }

  if (field === 'trace') {
    const target = getTraceDetailsUrl({
      traceSlug: data.trace,
      timestamp: data.timestamp,
      organization,
      dateSelection,
      location,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  if (['id', 'span_id', 'transaction.id'].includes(field)) {
    const spanId = field === 'transaction.id' ? undefined : data.span_id ?? data.id;
    const target = generateLinkToEventInTraceView({
      projectSlug: data.project,
      traceSlug: data.trace,
      timestamp: data.timestamp,
      targetId: data['transaction.span_id'],
      eventId: undefined,
      organization,
      location,
      spanId,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  return (
    <CellAction
      column={column}
      dataRow={data as TableDataRow}
      handleCellAction={(actions, value) => {
        updateQuery(query, actions, column, value);
        setUserQuery(query.formatString());
      }}
      allowActions={ALLOWED_CELL_ACTIONS}
    >
      {rendered}
    </CellAction>
  );
}

const StyledTimeSince = styled(TimeSince)`
  width: fit-content;
`;
