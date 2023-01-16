import {useState} from 'react';
import isEqual from 'lodash/isEqual';

import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {tn} from 'sentry/locale';
import {EventAttachment} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {EventDataSection} from './eventDataSection';
import {ViewHierarchy, ViewHierarchyData} from './viewHierarchy';

const DEFAULT_RESPONSE: ViewHierarchyData = {rendering_system: '', windows: []};
const FIVE_SECONDS_IN_MS = 5 * 1000;

type Props = {
  projectSlug: string;
  viewHierarchies: EventAttachment[];
};

function EventViewHierarchy({projectSlug, viewHierarchies}: Props) {
  const [selectedViewHierarchy] = useState(0);
  const organization = useOrganization();

  const hierarchyMeta = viewHierarchies[selectedViewHierarchy];
  const {isLoading, data} = useQuery<string>(
    [
      getAttachmentUrl({
        attachment: hierarchyMeta,
        eventId: hierarchyMeta.event_id,
        orgId: organization.slug,
        projectId: projectSlug,
      }),
    ],
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
      <ViewHierarchy viewHierarchy={JSON.parse(data)} />
    </EventDataSection>
  );
}

export {EventViewHierarchy};
