import React from 'react';
import omit from 'lodash/omit';

import {Event, Project} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';
import withProjects from 'app/utils/withProjects';
import {generateEventSlug, eventDetailsRoute} from 'app/utils/discover/urls';
import Link from 'app/components/links/link';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';
import {BreadcrumbTypeDefault} from '../types';
import BreadcrumbDataSummary from './breadcrumbDataSummary';

type Props = {
  breadcrumb: BreadcrumbTypeDefault;
  event: Event;
  orgId: string | null;
};

const BreadcrumbDataException = ({breadcrumb, event, orgId}: Props) => {
  const {data} = breadcrumb;
  const dataValue = data?.value;

  return (
    <BreadcrumbDataSummary kvData={omit(data, ['type', 'value'])}>
      {data?.type &&
        getBreadcrumbCustomRendererValue({
          value: <strong>{`${data.type}: `}</strong>,
          meta: getMeta(data, 'type'),
        })}
      {defined(dataValue) &&
        getBreadcrumbCustomRendererValue({
          value: breadcrumb?.message ? `${dataValue}. ` : dataValue,
          meta: getMeta(data, 'value'),
        })}
      {breadcrumb?.message &&
        getBreadcrumbCustomRendererValue({
          value: (
            <FormatMessage
              event={event}
              orgId={orgId}
              breadcrumb={breadcrumb}
              message={breadcrumb.message}
            />
          ),
          meta: getMeta(breadcrumb, 'message'),
        })}
    </BreadcrumbDataSummary>
  );
};

function isEventId(maybeEventId: string): boolean {
  // maybeEventId is an event id if it's a hex string of 32 characters long
  return /^[a-fA-F0-9]{32}$/.test(maybeEventId);
}

const FormatMessage = withProjects(function FormatMessageInner({
  event,
  message,
  breadcrumb,
  projects,
  loadingProjects,
  orgId,
}: {
  event: Event;
  projects: Project[];
  loadingProjects: boolean;
  breadcrumb: BreadcrumbTypeDefault;
  message: string;
  orgId: string | null;
}) {
  if (
    !loadingProjects &&
    typeof orgId === 'string' &&
    breadcrumb.category === 'sentry.transaction' &&
    isEventId(message)
  ) {
    const maybeProject = projects.find(project => {
      return project.id === event.projectID;
    });

    if (!maybeProject) {
      return <React.Fragment>{message}</React.Fragment>;
    }

    const projectSlug = maybeProject.slug;
    const eventSlug = generateEventSlug({project: projectSlug, id: message});

    return <Link to={eventDetailsRoute({orgSlug: orgId, eventSlug})}>{message}</Link>;
  }

  return <React.Fragment>{message}</React.Fragment>;
});

export default BreadcrumbDataException;
