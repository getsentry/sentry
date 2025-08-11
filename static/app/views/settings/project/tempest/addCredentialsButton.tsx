import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

interface AddCredentialsButtonProps {
  project: Project;
}

export function AddCredentialsButton({project}: AddCredentialsButtonProps) {
  const organization = useOrganization();
  const hasWriteAccess = useHasTempestWriteAccess();

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
