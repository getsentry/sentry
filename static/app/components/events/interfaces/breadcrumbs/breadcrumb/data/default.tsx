import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Highlight from 'sentry/components/highlight';
import Link from 'sentry/components/links/link';
import {Organization, Project} from 'sentry/types';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import withProjects from 'sentry/utils/withProjects';

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

const FormatMessage = withProjects(function FormatMessageInner({
  searchTerm,
  event,
  message,
  breadcrumb,
  projects,
  loadingProjects,
  orgSlug,
}: {
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  loadingProjects: boolean;
  message: string;
  orgSlug: Organization['slug'];
  projects: Project[];
  searchTerm: string;
  event?: Event;
}) {
  const content = <Highlight text={searchTerm}>{message}</Highlight>;
  if (
    !loadingProjects &&
    breadcrumb.category === 'sentry.transaction' &&
    isEventId(message)
  ) {
    const maybeProject = projects.find(project => {
      return event && project.id === event.projectID;
    });

    if (!maybeProject) {
      return content;
    }

    const projectSlug = maybeProject.slug;
    const eventSlug = generateEventSlug({project: projectSlug, id: message});

    return <Link to={getTransactionDetailsUrl(orgSlug, eventSlug)}>{content}</Link>;
  }

  return content;
});
