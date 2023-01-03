import {useState} from 'react';
import isEqual from 'lodash/isEqual';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {tn} from 'sentry/locale';
import {EventAttachment} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {RenderingSystem} from './viewHierarchy/renderingSystem';
import {ViewHierarchy} from './viewHierarchy/tree';
import EventDataSection from './eventDataSection';

const DEFAULT_RESPONSE = {rendering_system: '', windows: []};
const FIVE_SECONDS_IN_MS = 5 * 1000;

function fillWithUniqueIds(hierarchy) {
  return {
    ...hierarchy,
    id: uniqueId(),
    children: hierarchy.children.map(fillWithUniqueIds),
  };
}

type Props = {
  viewHierarchies: EventAttachment[];
};

function EventViewHierarchy({viewHierarchies}: Props) {
  const [selectedViewHierarchy] = useState(0);
  const [selectedViewHierarchyWindow] = useState(0);
  const api = useApi();
  const organization = useOrganization();

  const hierarchyMeta = viewHierarchies[selectedViewHierarchy];
  const {isLoading, data} = useQuery(
    [
      `/projects/${organization.slug}/sentry-cocoa/events/${hierarchyMeta?.event_id}/attachments/${hierarchyMeta?.id}/?download`,
    ],
    async () => {
      if (!hierarchyMeta) {
        return DEFAULT_RESPONSE;
      }

      const response = await api.requestPromise(
        `/projects/${organization.slug}/sentry-cocoa/events/${hierarchyMeta?.event_id}/attachments/${hierarchyMeta?.id}/?download`,
        {
          method: 'GET',
        }
      );

      if (!response) {
        return DEFAULT_RESPONSE;
      }

      const JSONdata = JSON.parse(response);

      return {
        rendering_system: JSONdata.rendering_system,
        // Recursively add unique IDs to the nodes for rendering the tree,
        // and to correlate elements when hovering between tree and wireframe
        windows: JSONdata.windows.map(fillWithUniqueIds),
      };
    },
    {staleTime: FIVE_SECONDS_IN_MS, refetchOnWindowFocus: false}
  );

  if (isLoading || !data || isEqual(DEFAULT_RESPONSE, data)) {
    return <LoadingIndicator />;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={tn('View Hierarchy', 'View Hierarchies', viewHierarchies.length)}
    >
      <RenderingSystem system={data.rendering_system} />
      <ViewHierarchy hierarchy={data.windows[selectedViewHierarchyWindow]} />
    </EventDataSection>
  );
}

export {EventViewHierarchy};
