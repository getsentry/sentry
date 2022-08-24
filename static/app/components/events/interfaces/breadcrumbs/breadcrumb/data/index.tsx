import {Organization} from 'sentry/types';
import {BreadcrumbType, RawCrumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

import {Default} from './default';
import {Exception} from './exception';
import {Http} from './http';
import {LinkedEvent} from './linkedEvent';

type Props = Pick<React.ComponentProps<typeof LinkedEvent>, 'route' | 'router'> & {
  breadcrumb: RawCrumb;
  event: Event;
  organization: Organization;
  searchTerm: string;
  meta?: Record<any, any>;
};

export function Data({
  breadcrumb,
  event,
  organization,
  searchTerm,
  meta,
  route,
  router,
}: Props) {
  const orgSlug = organization.slug;

  const linkedEvent =
    !!organization.features?.includes('breadcrumb-linked-event') &&
    breadcrumb.event_id ? (
      <LinkedEvent
        orgSlug={orgSlug}
        eventId={breadcrumb.event_id}
        route={route}
        router={router}
      />
    ) : undefined;

  if (breadcrumb.type === BreadcrumbType.HTTP) {
    return (
      <Http
        breadcrumb={breadcrumb}
        searchTerm={searchTerm}
        linkedEvent={linkedEvent}
        meta={meta}
      />
    );
  }

  if (
    breadcrumb.type === BreadcrumbType.WARNING ||
    breadcrumb.type === BreadcrumbType.ERROR
  ) {
    return (
      <Exception
        breadcrumb={breadcrumb}
        searchTerm={searchTerm}
        linkedEvent={linkedEvent}
        meta={meta}
      />
    );
  }

  return (
    <Default
      event={event}
      orgSlug={orgSlug}
      breadcrumb={breadcrumb}
      searchTerm={searchTerm}
      linkedEvent={linkedEvent}
      meta={meta}
    />
  );
}
