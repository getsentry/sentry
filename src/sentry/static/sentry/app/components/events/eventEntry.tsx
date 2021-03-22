import React from 'react';

import Breadcrumbs from 'app/components/events/interfaces/breadcrumbs';
import Csp from 'app/components/events/interfaces/csp';
import DebugMeta from 'app/components/events/interfaces/debugMeta';
import DebugMetaV2 from 'app/components/events/interfaces/debugMeta-v2';
import Exception from 'app/components/events/interfaces/exception';
import Generic from 'app/components/events/interfaces/generic';
import Message from 'app/components/events/interfaces/message';
import Request from 'app/components/events/interfaces/request';
import Spans from 'app/components/events/interfaces/spans';
import Stacktrace from 'app/components/events/interfaces/stacktrace';
import Template from 'app/components/events/interfaces/template';
import Threads from 'app/components/events/interfaces/threads';
import {Group, Organization, Project, SharedViewOrganization} from 'app/types';
import {Entry, EntryType, Event, EventTransaction} from 'app/types/event';

type Props = {
  entry: Entry;
  projectSlug: Project['slug'];
  event: Event;
  organization: SharedViewOrganization | Organization;
  groupId?: Group['id'];
};

function EventEntry({entry, projectSlug, event, organization, groupId}: Props) {
  switch (entry.type) {
    case EntryType.EXCEPTION: {
      const {data, type} = entry;
      return <Exception type={type} event={event} data={data} projectId={projectSlug} />;
    }
    case EntryType.MESSAGE: {
      const {data} = entry;
      return <Message data={data} />;
    }
    case EntryType.REQUEST: {
      const {data, type} = entry;
      return <Request type={type} event={event} data={data} />;
    }
    case EntryType.STACKTRACE: {
      const {data, type} = entry;
      return <Stacktrace type={type} event={event} data={data} projectId={projectSlug} />;
    }
    case EntryType.TEMPLATE: {
      const {data, type} = entry;
      return <Template type={type} event={event} data={data} />;
    }
    case EntryType.CSP: {
      const {data} = entry;
      return <Csp event={event} data={data} />;
    }
    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE:
    case EntryType.HPKP: {
      const {data, type} = entry;
      return <Generic type={type} data={data} />;
    }
    case EntryType.BREADCRUMBS: {
      const {data, type} = entry;
      return (
        <Breadcrumbs
          type={type}
          data={data}
          organization={organization as Organization}
          event={event}
        />
      );
    }
    case EntryType.THREADS: {
      const {data, type} = entry;
      return <Threads type={type} event={event} data={data} projectId={projectSlug} />;
    }
    case EntryType.DEBUGMETA:
      const {data} = entry;
      const hasImagesLoadedV2Feature = !!organization.features?.includes(
        'images-loaded-v2'
      );

      if (hasImagesLoadedV2Feature) {
        return (
          <DebugMetaV2
            event={event}
            projectId={projectSlug}
            groupId={groupId}
            organization={organization as Organization}
            data={data as React.ComponentProps<typeof DebugMetaV2>['data']}
          />
        );
      }

      return (
        <DebugMeta
          event={event}
          projectId={projectSlug}
          organization={organization as Organization}
          data={data}
        />
      );

    case EntryType.SPANS:
      return (
        <Spans
          event={event as EventTransaction}
          organization={organization as Organization}
        />
      );
    default:
      // this should not happen
      /*eslint no-console:0*/
      window.console &&
        console.error &&
        console.error('Unregistered interface: ' + (entry as any).type);
      return null;
  }
}

export default EventEntry;
