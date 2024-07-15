import type {BreadcrumbTransactionEvent} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import Link from 'sentry/components/links/link';
import type {
  BreadcrumbTypeDefault,
  BreadcrumbTypeNavigation,
} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  organization: Organization;
  searchTerm: string;
  event?: Event;
  meta?: Record<any, any>;
  transactionEvents?: BreadcrumbTransactionEvent[];
};

export function Default({
  meta,
  breadcrumb,
  event,
  organization,
  searchTerm,
  transactionEvents,
}: Props) {
  const {message, data} = breadcrumb;

  return (
    <Summary kvData={data} meta={meta}>
      {meta?.message?.[''] ? (
        <AnnotatedText value={message} meta={meta?.message?.['']} />
      ) : (
        defined(message) && (
          <FormatMessage
            searchTerm={searchTerm}
            event={event}
            organization={organization}
            breadcrumb={breadcrumb}
            message={message}
            transactionEvents={transactionEvents}
          />
        )
      )}
    </Summary>
  );
}

export function isEventId(maybeEventId: string): boolean {
  // maybeEventId is an event id if it's a hex string of 32 characters long
  return /^[a-fA-F0-9]{32}$/.test(maybeEventId);
}

function FormatMessage({
  searchTerm,
  event,
  message,
  breadcrumb,
  organization,
  transactionEvents,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  message: string;
  organization: Organization;
  searchTerm: string;
  event?: Event;
  transactionEvents?: BreadcrumbTransactionEvent[];
}) {
  const location = useLocation();
  const content = <Highlight text={searchTerm}>{message}</Highlight>;

  const isSentryTransaction =
    breadcrumb.category === 'sentry.transaction' && isEventId(message);

  const {projects, fetching: fetchingProjects} = useProjects();
  const maybeProject = !fetchingProjects
    ? projects.find(project => {
        return event && project.id === event.projectID;
      })
    : null;

  const transactionData = transactionEvents?.find(
    transaction => transaction.id === message
  );

  if (isSentryTransaction) {
    if (!maybeProject) {
      return content;
    }

    const projectSlug = maybeProject.slug;
    const description = transactionData ? (
      <Link
        to={generateLinkToEventInTraceView({
          eventId: message,
          timestamp: transactionData.timestamp,
          traceSlug: transactionData.trace,
          projectSlug,
          organization,
          location: {...location, query: {...location.query, referrer: 'breadcrumbs'}},
        })}
      >
        <Highlight text={searchTerm}>{transactionData.title}</Highlight>
      </Link>
    ) : (
      content
    );

    return description;
  }

  return content;
}
