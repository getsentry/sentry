import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';

type AutofixWarning = {
  warning_type: string;
  installation_id?: string;
  installation_url?: string;
  repo_name?: string;
};

function InstallationPermissionsButton({installationUrl}: {installationUrl?: string}) {
  const {openModal} = useModal();
  return (
    <Button
      variant="primary"
      size="xs"
      onClick={() =>
        openModal(deps => (
          <AutofixGithubAppPermissionsModal
            {...deps}
            installationUrl={installationUrl}
            variant="pr_iteration"
          />
        ))
      }
    >
      {t('Update Permissions')}
    </Button>
  );
}

function ConfigurationPermissionsButton() {
  const organization = useOrganization();
  const configurationUrl = `/settings/${organization.slug}/integrations/github/?tab=configurations`;

  return (
    <LinkButton to={configurationUrl} variant="primary" size="xs">
      {t('Update Permissions')}
    </LinkButton>
  );
}

export function AutofixWarnings({
  warnings,
  groupId,
}: {
  groupId: string;
  warnings: AutofixWarning[];
}) {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:${groupId}:autofix-github-permissions-warning`,
    expirationDays: 7,
  });

  if (!warnings.length || isDismissed) {
    return null;
  }

  const permissionWarnings = warnings.filter(
    w => w.warning_type === 'github_app_permissions'
  );

  if (!permissionWarnings.length) {
    return null;
  }

  const installationIds = [
    ...new Set(permissionWarnings.map(w => w.installation_id).filter(defined)),
  ];
  const [installationId] = installationIds;

  const comp =
    installationIds.length === 1 && defined(installationId) ? (
      <InstallationPermissionsButton
        installationUrl={
          permissionWarnings.find(w => w.installation_id === installationId)
            ?.installation_url
        }
      />
    ) : (
      <ConfigurationPermissionsButton />
    );

  return (
    <Stack gap="md" padding="md 2xl 0">
      <Alert
        variant="warning"
        trailingItems={
          <Flex gap="sm" alignSelf="center">
            {comp}
            <Button
              icon={<IconClose />}
              variant="transparent"
              size="xs"
              aria-label={t('Dismiss')}
              onClick={dismiss}
            />
          </Flex>
        }
      >
        {t(
          'Seer needs more GitHub App permissions to keep fixing CI on your pull requests.'
        )}
      </Alert>
    </Stack>
  );
}
