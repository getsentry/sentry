import styled from '@emotion/styled';

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
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';

import Summary from './summary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  orgSlug: Organization['slug'];
  searchTerm: string;
  event?: Event;
  meta?: Record<any, any>;
};

export function Default({meta, breadcrumb, event, orgSlug, searchTerm}: Props) {
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
          />
        )
      )}
    </Summary>
  );
}

function isEventId(maybeEventId: string): boolean {
  // maybeEventId is an event id if it's a hex string of 32 characters long
  return /^[a-fA-F0-9]{32}$/.test(maybeEventId);
}

type DataItem = {
  id: string;
  'project.name': string;
  title: string;
};

function FormatMessage({
  searchTerm,
  event,
  message,
  breadcrumb,
  orgSlug,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  message: string;
  orgSlug: Organization['slug'];
  searchTerm: string;
  event?: Event;
}) {
  const {projects, fetching: loadingProjects} = useProjects();

  const content = <Highlight text={searchTerm}>{message}</Highlight>;

  const isSentryTransaction =
    breadcrumb.category === 'sentry.transaction' && isEventId(message);

  const maybeProject = !loadingProjects
    ? projects.find(project => {
        return event && project.id === event.projectID;
      })
    : null;

  const {data: queryData} = useApiQuery<{data: DataItem[]; meta: any}>(
    [
      `/organizations/${orgSlug}/events/`,
      {
        query: {
          query: `id:${message}`,
          field: ['title'],
          project: [maybeProject?.id],
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: defined(maybeProject) && isSentryTransaction,
    }
  );

  if (isSentryTransaction) {
    if (!maybeProject) {
      return content;
    }
    const projectSlug = maybeProject.slug;
    const eventSlug = generateEventSlug({project: projectSlug, id: message});

    const description =
      queryData && queryData.data.length > 0 ? (
        <Link to={getTransactionDetailsUrl(orgSlug, eventSlug)}>
          <Highlight text={searchTerm}>{queryData.data[0].title}</Highlight>
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
