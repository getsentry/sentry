import styled from '@emotion/styled';

import type {BreadcrumbTransactionEvent} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import useProjects from 'sentry/utils/useProjects';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  orgSlug: Organization['slug'];
  searchTerm: string;
  event?: Event;
  meta?: Record<any, any>;
  transactionEvents?: BreadcrumbTransactionEvent[];
};

export function Default({
  meta,
  breadcrumb,
  event,
  orgSlug,
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
            orgSlug={orgSlug}
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
  orgSlug,
  transactionEvents,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  message: string;
  orgSlug: Organization['slug'];
  searchTerm: string;
  event?: Event;
  transactionEvents?: BreadcrumbTransactionEvent[];
}) {
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
    const eventSlug = generateEventSlug({project: projectSlug, id: message});

    const description = transactionData ? (
      <Link
        to={getTransactionDetailsUrl(orgSlug, eventSlug, undefined, {
          referrer: 'breadcrumbs',
        })}
      >
        <Highlight text={searchTerm}>{transactionData.title}</Highlight>
      </Link>
    ) : (
      content
    );

    return description;
  }
  switch (breadcrumb.messageFormat) {
    case 'sql':
      return <FormattedCode>{content}</FormattedCode>;
    default:
      return content;
  }
}

const FormattedCode = styled('div')`
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow-x: auto;
  white-space: pre;
`;
