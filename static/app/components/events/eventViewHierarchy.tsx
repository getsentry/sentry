import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {tn} from 'sentry/locale';
import {EventAttachment, Project} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {EventDataSection} from './eventDataSection';
import {ViewHierarchy, ViewHierarchyData} from './viewHierarchy';

const FIVE_SECONDS_IN_MS = 5 * 1000;

type Props = {
  project: Project;
  viewHierarchies: EventAttachment[];
};

function EventViewHierarchy({project, viewHierarchies}: Props) {
  const organization = useOrganization();

  // There should be only one view hierarchy
  const hierarchyMeta = viewHierarchies[0];
  const {isLoading, data} = useQuery<string>(
    [
      getAttachmentUrl({
        attachment: hierarchyMeta,
        eventId: hierarchyMeta.event_id,
        orgId: organization.slug,
        projectSlug: project.slug,
      }),
    ],
    {staleTime: FIVE_SECONDS_IN_MS, refetchOnWindowFocus: false}
  );

  // Memoize the JSON parsing because downstream hooks depend on
  // referential equality of objects in the data
  const hierarchy = useMemo<ViewHierarchyData>(() => {
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (err) {
      Sentry.captureException(err);
      return null;
    }
  }, [data]);

  // TODO(nar): This loading behaviour is subject to change
  if (isLoading || !data) {
    return <LoadingIndicator />;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={tn('View Hierarchy', 'View Hierarchies', viewHierarchies.length)}
    >
      <ErrorBoundary mini>
        <ViewHierarchy viewHierarchy={hierarchy} project={project} />
      </ErrorBoundary>
    </EventDataSection>
  );
}

export {EventViewHierarchy};
