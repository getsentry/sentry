import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import Highlight from 'sentry/components/highlight';
import Link from 'sentry/components/links/link';
import {Organization, Project} from 'sentry/types';
import {BreadcrumbTypeDefault, BreadcrumbTypeNavigation} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import {eventDetailsRoute, generateEventSlug} from 'sentry/utils/discover/urls';
import withProjects from 'sentry/utils/withProjects';

import Summary from './summary';

type Props = {
  searchTerm: string;
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  event: Event;
  orgSlug: Organization['slug'];
  linkedEvent?: React.ReactElement;
};

function Default({breadcrumb, event, orgSlug, searchTerm, linkedEvent}: Props) {
  const {message} = breadcrumb;
  return (
    <Summary kvData={breadcrumb.data}>
      {linkedEvent}
      {message && (
        <AnnotatedText
          value={
            <FormatMessage
              searchTerm={searchTerm}
              event={event}
              orgSlug={orgSlug}
              breadcrumb={breadcrumb}
              message={message}
            />
          }
          meta={getMeta(breadcrumb, 'message')}
        />
      )}
    </Summary>
  );
}

export default Default;

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
  searchTerm: string;
  event: Event;
  projects: Project[];
  loadingProjects: boolean;
  breadcrumb: BreadcrumbTypeDefault | BreadcrumbTypeNavigation;
  message: string;
  orgSlug: Organization['slug'];
}) {
  const content = <Highlight text={searchTerm}>{message}</Highlight>;
  if (
    !loadingProjects &&
    breadcrumb.category === 'sentry.transaction' &&
    isEventId(message)
  ) {
    const maybeProject = projects.find(project => {
      return project.id === event.projectID;
    });

    if (!maybeProject) {
      return content;
    }

    const projectSlug = maybeProject.slug;
    const eventSlug = generateEventSlug({project: projectSlug, id: message});

    return <Link to={eventDetailsRoute({orgSlug, eventSlug})}>{content}</Link>;
  }

  return content;
});
