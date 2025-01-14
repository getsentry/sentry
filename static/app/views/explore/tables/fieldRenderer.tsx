import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {Container} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import {
  useExploreQuery,
  useSetExploreQueryWithMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface FieldProps {
  column: TableColumn<keyof TableDataRow>;
  data: EventData;
  meta: MetaType;
  mode: Mode;
  unit?: string;
}

export function FieldRenderer({data, meta, unit, column, mode}: FieldProps) {
  const location = useLocation();
  const organization = useOrganization();
  const userQuery = useExploreQuery();
  const setUserQueryWithMode = useSetExploreQueryWithMode();
  const dateSelection = EventView.fromLocation(location).normalizeDateSelection(location);
  const query = new MutableSearch(userQuery);
  const field = column.name;

  const renderer = getExploreFieldRenderer(field, meta);

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

  if (field === 'profile.id') {
    const target = generateProfileFlamechartRouteWithQuery({
      orgSlug: organization.slug,
      projectSlug: data.project,
      profileId: data['profile.id'],
    });
    rendered = <Link to={target}>{rendered}</Link>;
  }

  const allowedCellActions =
    mode === Mode.AGGREGATE
      ? [...ALLOWED_CELL_ACTIONS, Actions.SAMPLES]
      : ALLOWED_CELL_ACTIONS;

  return (
    <CellAction
      column={column}
      dataRow={data as TableDataRow}
      handleCellAction={(actions, value) => {
        switch (actions) {
          case Actions.COPY:
            navigator.clipboard
              .writeText(value as string)
              .then(() => {
                addSuccessMessage(t('Copied to clipboard'));
              })
              .catch(() => {
                addErrorMessage(t('Error copying to clipboard'));
              });
            break;
          default:
            updateQuery(query, actions, column, value);
            setUserQueryWithMode(
              query.formatString(),
              // samples action means we switch to samples mode
              // otherwise, don't do anything
              actions === Actions.SAMPLES ? Mode.SAMPLES : undefined
            );
        }
      }}
      allowActions={allowedCellActions}
    >
      {rendered}
    </CellAction>
  );
}

function getExploreFieldRenderer(
  field: string,
  meta: MetaType
): ReturnType<typeof getFieldRenderer> {
  if (field === 'id' || field === 'span_id') {
    return eventIdRenderFunc(field);
  }
  return getFieldRenderer(field, meta, false);
}

function eventIdRenderFunc(field: string) {
  function renderer(data: EventData) {
    const spanId: string | unknown = data?.[field];
    if (typeof spanId !== 'string') {
      return null;
    }

    return <Container>{getShortEventId(spanId)}</Container>;
  }
  return renderer;
}

const StyledTimeSince = styled(TimeSince)`
  width: fit-content;
`;
