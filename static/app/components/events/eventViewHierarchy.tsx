import {useState} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {tn} from 'sentry/locale';
import {EventAttachment} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import {RenderingSystem} from './viewHierarchies/renderingSystem';
import {ViewHierarchyTree} from './viewHierarchies/viewHierarchyTree';
import EventDataSection from './eventDataSection';

type Props = {
  viewHierarchies: EventAttachment[];
};
function EventViewHierarchy({viewHierarchies}: Props) {
  const [selectedViewHierarchy, _] = useState(0);
  const api = useApi();
  const {isLoading, data} = useQuery(
    [
      `/projects/sentry-sdks/sentry-cocoa/events/${viewHierarchies[selectedViewHierarchy]?.event_id}/attachments/${viewHierarchies[selectedViewHierarchy]?.id}/?download`,
    ],
    async () => {
      const response = await api.requestPromise(
        `/projects/sentry-sdks/sentry-cocoa/events/${viewHierarchies[selectedViewHierarchy]?.event_id}/attachments/${viewHierarchies[selectedViewHierarchy]?.id}/?download`,
        {
          method: 'GET',
        }
      );
      if (!response) {
        return {};
      }
      return JSON.parse(response);
    },
    {staleTime: 1000}
  );

  if (!viewHierarchies.length) {
    return null;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={tn('View Hierarchy', 'View Hierarchies', viewHierarchies.length)}
    >
      <RenderingSystem system={data.rendering_system} />
      <ViewHierarchyTree hierarchy={data} />
    </EventDataSection>
  );
}

export {EventViewHierarchy};
