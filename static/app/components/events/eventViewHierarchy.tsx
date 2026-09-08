import {useMemo} from 'react';
import * as Sentry from '@sentry/react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {useFetchEventAttachments} from 'sentry/actionCreators/events';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  getPlatform,
  getPlatformViewConfig,
} from 'sentry/components/events/viewHierarchy/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import type {ViewHierarchyData} from './viewHierarchy';
import {ViewHierarchy} from './viewHierarchy';

type Props = {
  event: Event;
  project: Project;
  disableCollapsePersistence?: boolean;
};

function EventViewHierarchyContent({event, project, disableCollapsePersistence}: Props) {
  const organization = useOrganization();

  const {data: attachments} = useFetchEventAttachments(
    {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      eventId: event.id,
    },
    {notifyOnChangeProps: ['data']}
  );
  const hierarchyMeta = attachments?.find(
    attachment => attachment.type === 'event.view_hierarchy'
  );

  // There should be only one view hierarchy.
  const hierarchyQuery = useQuery({
    ...apiOptions.as<string | ViewHierarchyData>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/',
      {
        path: hierarchyMeta
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              eventId: hierarchyMeta.event_id,
              attachmentId: hierarchyMeta.id,
            }
          : skipToken,
        headers: {
          Accept: '*/*; charset=utf-8',
        },
        query: {
          download: true,
        },
        staleTime: Infinity,
      }
    ),
    retry: false,
  });

  // Memoize the JSON parsing because downstream hooks depend on
  // referential equality of objects in the data
  const hierarchy = useMemo(() => {
    if (!hierarchyQuery.data) {
      return null;
    }

    if (typeof hierarchyQuery.data !== 'string') {
      return hierarchyQuery.data;
    }

    try {
      return JSON.parse(hierarchyQuery.data) as ViewHierarchyData;
    } catch (err) {
      Sentry.captureException(err);
      return null;
    }
  }, [hierarchyQuery.data]);

  if (!hierarchyMeta) {
    return null;
  }

  const platform = getPlatform({event, project});
  const platformViewConfig = getPlatformViewConfig(platform);

  return (
    <FoldSection
      sectionKey={SectionKey.VIEW_HIERARCHY}
      title={platformViewConfig.title}
      disableCollapsePersistence={disableCollapsePersistence}
    >
      {hierarchyQuery.isPending ? (
        <LoadingIndicator />
      ) : hierarchyQuery.isError ? (
        <LoadingError
          message={getRequestErrorUserMessage(
            hierarchyQuery.error,
            t('Failed to load view hierarchy.')
          )}
          onRetry={hierarchyQuery.refetch}
        />
      ) : (
        <ErrorBoundary mini>
          <ViewHierarchy
            viewHierarchy={hierarchy}
            platform={platform}
            emptyMessage={platformViewConfig.emptyMessage}
            showWireframe={platformViewConfig.showWireframe}
            nodeField={platformViewConfig.nodeField}
          />
        </ErrorBoundary>
      )}
    </FoldSection>
  );
}

export function EventViewHierarchy(props: Props) {
  const organization = useOrganization();

  if (!organization.features.includes('event-attachments')) {
    return null;
  }

  return <EventViewHierarchyContent {...props} />;
}
