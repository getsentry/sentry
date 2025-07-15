import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Link} from 'sentry/components/core/link';
import useReplayBulkDeleteAuditLog from 'sentry/components/replays/bulkDelete/useReplayBulkDeleteAuditLog';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

interface Props {
  projectId: string;
}

export default function BulkDeleteAlert({projectId}: Props) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});

  const {data} = useReplayBulkDeleteAuditLog({
    projectSlug: project?.slug ?? '',
    query: {per_page: 10, offset: 0, referrer: 'replay-list'},
    enabled: project && (hasWriteAccess || hasAdminAccess),
  });

  if ((!hasWriteAccess && !hasAdminAccess) || !project) {
    return null;
  }

  // TODO: This only looks at the first page of results.
  // It would be better to be able to search for jobs in progress to be sure.
  // The expectation is that only one job is running at a time.
  const hasAnyInProgress = data?.data?.some(job =>
    ['pending', 'in-progress'].includes(job?.status ?? '')
  );

  if (hasAnyInProgress) {
    return (
      <Alert
        type="info"
        showIcon
        expand={tct('Visit the [link: Job log] to see more details and track progress.', {
          link: (
            <Link
              to={`/organizations/${organization.slug}/settings/projects/${project.slug}/replays/?replaySettingsTab=bulk-delete`}
            />
          ),
        })}
      >
        {t(
          'Replays are being deleted in the background. Items shown below may be stale.'
        )}
      </Alert>
    );
  }
  return null;
}
