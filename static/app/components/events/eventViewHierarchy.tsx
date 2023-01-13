import {useState} from 'react';
import isEqual from 'lodash/isEqual';

import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {tn} from 'sentry/locale';
import {type EventAttachment} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {EventDataSection} from './eventDataSection';
import {type ViewHierarchyData, ViewHierarchy} from './viewHierarchy';

const DEFAULT_RESPONSE: ViewHierarchyData = {rendering_system: '', windows: []};
const FIVE_SECONDS_IN_MS = 5 * 1000;

function fillWithUniqueIds(hierarchy) {
  return {
    ...hierarchy,
    id: uniqueId(),
    children: hierarchy.children?.map(fillWithUniqueIds) ?? [],
  };
}

type Props = {
  projectSlug: string;
  viewHierarchies: EventAttachment[];
};

function EventViewHierarchy({projectSlug, viewHierarchies}: Props) {
  const [selectedViewHierarchy] = useState(0);
  const api = useApi();
  const organization = useOrganization();

  const hierarchyMeta = viewHierarchies[selectedViewHierarchy];
  const {isLoading, data} = useQuery<ViewHierarchyData>(
    [`viewHierarchies.${hierarchyMeta.id}`],
    async () => {
      const response = await api.requestPromise(
        getAttachmentUrl({
          attachment: hierarchyMeta,
          eventId: hierarchyMeta.event_id,
          orgId: organization.slug,
          projectId: projectSlug,
        }),
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

  // TODO(nar): This loading behaviour is subject to change
  if (isLoading || !data || isEqual(DEFAULT_RESPONSE, data)) {
    return <LoadingIndicator />;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={tn('View Hierarchy', 'View Hierarchies', viewHierarchies.length)}
    >
      <ViewHierarchy viewHierarchy={data} />
    </EventDataSection>
  );
}

export {EventViewHierarchy};
