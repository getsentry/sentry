import {Fragment} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceMetadataHeader';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface FieldProps {
  data: EventData;
  dataset: DiscoverDatasets;
  field: string;
  meta: MetaType;
  unit?: string;
}

export function FieldRenderer({data, dataset, field, meta, unit}: FieldProps) {
  const location = useLocation();
  const organization = useOrganization();
  const dateSelection = EventView.fromLocation(location).normalizeDateSelection(location);

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
      eventId:
        dataset === DiscoverDatasets.SPANS_INDEXED ? data['transaction.id'] : undefined,
      organization,
      location,
      spanId,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  return <Fragment>{rendered}</Fragment>;
}

const StyledTimeSince = styled(TimeSince)`
  width: fit-content;
`;
