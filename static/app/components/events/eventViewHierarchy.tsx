import {Fragment, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {useFetchEventAttachments} from 'sentry/actionCreators/events';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {EventDataSection} from './eventDataSection';
import type {ViewHierarchyData} from './viewHierarchy';
import {ViewHierarchy} from './viewHierarchy';

type Props = {
  event: Event;
  project: Project;
};

function EventViewHierarchyContent({event, project}: Props) {
  const organization = useOrganization();

  const {data: attachments} = useFetchEventAttachments(
    {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      eventId: event.id,
    },
    {notifyOnChangeProps: ['data']}
  );
  const viewHierarchies =
    attachments?.filter(attachment => attachment.type === 'event.view_hierarchy') ?? [];
  const hierarchyMeta: IssueAttachment | undefined = viewHierarchies[0];

  // There should be only one view hierarchy
  const {isLoading, data} = useApiQuery<string | ViewHierarchyData>(
    [
      defined(hierarchyMeta)
        ? getAttachmentUrl({
            attachment: hierarchyMeta,
            eventId: hierarchyMeta.event_id,
            orgId: organization.slug,
            projectSlug: project.slug,
          })
        : '',
      {
        headers: {
          Accept: '*/*; charset=utf-8',
        },
      },
    ],
    {staleTime: Infinity, enabled: defined(hierarchyMeta)}
  );

  // Memoize the JSON parsing because downstream hooks depend on
  // referential equality of objects in the data
  const hierarchy = useMemo<ViewHierarchyData>(() => {
    if (!data) {
      return null;
    }

    if (data && typeof data !== 'string') {
      return data;
    }

    try {
      return JSON.parse(data);
    } catch (err) {
      Sentry.captureException(err);
      return null;
    }
  }, [data]);

  if (viewHierarchies.length === 0) {
    return null;
  }

  if (isLoading || !data) {
    return <LoadingIndicator />;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={
        <Fragment>
          {t('View Hierarchy')}

          <FeatureBadge type="new" />
        </Fragment>
      }
    >
      <ErrorBoundary mini>
        <ViewHierarchy viewHierarchy={hierarchy} project={project} />
      </ErrorBoundary>
    </EventDataSection>
  );
}

function EventViewHierarchy(props: Props) {
  const organization = useOrganization();

  if (!organization.features.includes('event-attachments')) {
    return null;
  }

  return <EventViewHierarchyContent {...props} />;
}

export {EventViewHierarchy};
