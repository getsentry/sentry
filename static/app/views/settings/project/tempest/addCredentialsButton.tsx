import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

interface AddCredentialsButtonProps {
  projectSlug: string;
}

export function AddCredentialsButton({projectSlug}: AddCredentialsButtonProps) {
  const organization = useOrganization();
  const hasWriteAccess = useHasTempestWriteAccess();

  const {projects} = useProjects({slugs: [projectSlug]});
  const project = projects[0];

  if (!project) {
    return null;
  }

  return (
    <Tooltip
      title={t('You must be an organization admin to add new credentials.')}
      disabled={hasWriteAccess}
    >
      <Button
        priority="primary"
        size="sm"
        data-test-id="create-new-credentials"
        disabled={!hasWriteAccess}
        icon={<IconAdd isCircled />}
        onClick={() => {
          openAddTempestCredentialsModal({organization, project});
          trackAnalytics('tempest.credentials.add_modal_opened', {
            organization,
            project_slug: project.slug,
          });
        }}
      >
        {t('Add Credentials')}
      </Button>
    </Tooltip>
  );
}
