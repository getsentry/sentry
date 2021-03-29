import React from 'react';
import {Location} from 'history';

import ErrorBoundary from 'app/components/errorBoundary';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuickTrace from 'app/components/quickTrace';
import {generateTraceTarget} from 'app/components/quickTrace/utils';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getShortEventId} from 'app/utils/events';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';

import {MetaData} from './styles';

type Props = Pick<
  React.ComponentProps<typeof QuickTrace>,
  'errorDest' | 'transactionDest'
> & {
  event: Event;
  location: Location;
  organization: OrganizationSummary;
  quickTrace: QuickTraceQueryChildrenProps;
};

function handleTraceLink(organization: OrganizationSummary) {
  trackAnalyticsEvent({
    eventKey: 'quick_trace.trace_id.clicked',
    eventName: 'Quick Trace: Trace ID clicked',
    organization_id: parseInt(organization.id, 10),
    source: 'events',
  });
}

export default function QuickTraceMeta({
  event,
  location,
  organization,
  quickTrace: {isLoading, error, trace, type},
  errorDest,
  transactionDest,
}: Props) {
  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  const body = isLoading ? (
    <Placeholder height="27px" />
  ) : error || trace === null ? (
    '\u2014'
  ) : (
    <ErrorBoundary mini>
      <QuickTrace
        event={event}
        quickTrace={{type, trace}}
        location={location}
        organization={organization}
        anchor="right"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    </ErrorBoundary>
  );

  return (
    <MetaData
      headingText={t('Quick Trace')}
      tooltipText={t('A minified version of the full trace.')}
      bodyText={body}
      subtext={
        traceId === null ? (
          '\u2014'
        ) : (
          <Link to={traceTarget} onClick={() => handleTraceLink(organization)}>
            {t('Trace ID: %s', getShortEventId(traceId))}
          </Link>
        )
      }
    />
  );
}
