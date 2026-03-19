import {useState} from 'react';

import organizationDeletionIllustration from 'sentry-images/organizationDeletion.svg';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {LogoSentry} from 'sentry/components/logoSentry';
import {t, tct} from 'sentry/locale';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

type OrganizationProps = {
  organization: Organization;
};

type BodyProps = {
  children: React.ReactNode;
};

function DeletionInProgress({organization}: OrganizationProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      minHeight="100dvh"
      style={{
        backgroundImage: `url(${organizationDeletionIllustration})`,
        backgroundSize: 'contain',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Flex
        direction="column"
        align="start"
        gap="md"
        maxWidth="580px"
        padding="2xl"
        background="primary"
        radius="xl"
      >
        <LogoSentry height="24px" />
        <Heading as="h1">{t('Deletion In Progress')}</Heading>
        <Stack gap="lg" paddingTop="2xl">
          <Text as="p" size="lg">
            {tct(
              'The [organization] organization is currently in the process of being deleted from Sentry.',
              {
                organization: <strong>{organization.slug}</strong>,
              }
            )}
          </Text>
          <Text as="p" size="sm" variant="muted">
            {t(
              "Once deletion begins, there's no recovering the data that has been removed."
            )}
          </Text>
        </Stack>
      </Flex>
    </Flex>
  );
}

function DeletionPending({organization}: OrganizationProps) {
  const api = useApi();
  const [isRestoring, setIsRestoring] = useState(false);

  const onRestore = async () => {
    setIsRestoring(true);

    try {
      await api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {cancelDeletion: true},
      });
      window.location.reload();
    } catch {
      setIsRestoring(false);
      AlertStore.addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        variant: 'danger',
      });
    }
  };

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      minHeight="100dvh"
      style={{
        backgroundImage: `url(${organizationDeletionIllustration})`,
        backgroundSize: 'contain',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Flex
        direction="column"
        align="start"
        gap="md"
        maxWidth="580px"
        padding="2xl"
        background="primary"
        radius="xl"
      >
        <LogoSentry height="24px" />
        <Heading as="h1">{t('Deletion Scheduled')}</Heading>
        <Stack gap="lg" paddingTop="2xl">
          <Text as="p" size="lg">
            {tct('The [organization] organization is currently scheduled for deletion.', {
              organization: <strong>{organization.slug}</strong>,
            })}
            {'\u00A0'}
            {!organization.access.includes('org:admin') &&
              t(
                'If this is a mistake, contact an organization owner and ask them to restore this organization.'
              )}
          </Text>

          {organization.access.includes('org:admin') && (
            <Flex direction="column" gap="sm" paddingTop="xl">
              <Button priority="primary" onClick={onRestore} disabled={isRestoring}>
                {t('Restore Organization')}
              </Button>
            </Flex>
          )}

          <Text as="p" size="sm" variant="muted">
            {t(
              "Note: Restoration is available until the process begins. Once deletion begins, there's no recovering the data anymore."
            )}
          </Text>
        </Stack>
      </Flex>
    </Flex>
  );
}

export function OrganizationDetailsBody({children}: BodyProps) {
  // Organization may be null in account settings
  const organization = useOrganization({allowNull: true});

  const status = organization?.status?.id;

  if (organization && status === 'pending_deletion') {
    return <DeletionPending organization={organization} />;
  }

  if (organization && status === 'deletion_in_progress') {
    return <DeletionInProgress organization={organization} />;
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
