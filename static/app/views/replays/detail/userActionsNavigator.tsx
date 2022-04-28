import React from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import {Entry, Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

type Props = {
  entry: Entry | undefined;
  event: Event | undefined;
};

function UserActionsNavigator({event, entry}: Props) {
  // TODO(replay): New User Actions widget replaces this breadcrumb view

  const {routes, router} = useRouteContext();
  const organization = useOrganization();

  if (!entry || !event) {
    return null;
  }

  const projectSlug = getProjectSlug(event);

  return (
    <EventEntry
      projectSlug={projectSlug}
      // group={group}
      organization={organization}
      event={event}
      entry={entry}
      route={routes[routes.length - 1]}
      router={router}
    />
  );
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

export default UserActionsNavigator;
