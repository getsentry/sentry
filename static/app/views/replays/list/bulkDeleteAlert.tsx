import {useEffect, useRef} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import useReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/useReplayBulkDeleteAuditLog';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjectFromId from 'sentry/utils/useProjectFromId';

interface Props {
  projectId: string;
  onDidHide?: () => void;
}

export default function BulkDeleteAlert({projectId, onDidHide}: Props) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});
  const shouldRender = useShouldRenderBulkDeleteAlert({organization, project});
  const prevRender = usePrevious(shouldRender);

  useEffect(() => {
    if (shouldRender === false && prevRender === true) {
      onDidHide?.();
    }
  }, [onDidHide, prevRender, shouldRender]);

  return shouldRender && project ? (
    <DeleteInProgressAlert organization={organization} project={project} />
  ) : null;
}

function useShouldRenderBulkDeleteAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: Project | undefined;
}) {
  const analyticsArea = useAnalyticsArea();
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});

  const hasAnyInProgressRef = useRef(false);

  const {data} = useReplayBulkDeleteAuditLog({
    enabled: Boolean(project && (hasWriteAccess || hasAdminAccess)),
    projectSlug: project?.slug ?? '',
    query: {per_page: 10, offset: 0, referrer: analyticsArea},
    refetchIntervalMs: hasAnyInProgressRef.current ? 1_000 : 60_000,
  });

  useEffect(() => {
    // TODO: This only looks at the first page of results.
    // It would be better to be able to search for jobs in progress to be sure.
    // The expectation is that only one job is running at a time.
    hasAnyInProgressRef.current = Boolean(
      data?.data?.some(job => ['pending', 'in-progress'].includes(job?.status ?? ''))
    );
  }, [data?.data]);

  if ((!hasWriteAccess && !hasAdminAccess) || !project) {
    return false;
  }
  return hasAnyInProgressRef.current;
}

function DeleteInProgressAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
  return (
    <Alert
      variant="info"
      trailingItems={
        <LinkButton
          size="xs"
          to={`/organizations/${organization.slug}/settings/projects/${project.slug}/replays/?replaySettingsTab=bulk-delete`}
        >
          {t('Track Progress')}
        </LinkButton>
      }
    >
      {t(
        'Replays are being deleted in the background. The items shown below may be stale.'
      )}
    </Alert>
  );
}
