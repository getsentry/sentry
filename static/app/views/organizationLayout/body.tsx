import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import organizationDeletionIllustration from 'sentry-images/organizationDeletion.svg';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LogoSentry} from 'sentry/components/logoSentry';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGlobalAlerts} from 'sentry/views/app/globalAlerts';

type OrganizationProps = {
  organization: Organization;
};

type BodyProps = {
  children: React.ReactNode;
};

function DeletionInProgress({organization}: OrganizationProps) {
  return (
    <Stack
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
      <Stack
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
      </Stack>
    </Stack>
  );
}

function DeletionPending({organization}: OrganizationProps) {
  const {addAlert} = useGlobalAlerts();
  const [isRestoring, setIsRestoring] = useState(false);

  const {mutateAsync: cancelDeletion} = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'PUT',
        data: {cancelDeletion: true},
      }),
  });

  const onRestore = async () => {
    setIsRestoring(true);

    try {
      await cancelDeletion();
      testableWindowLocation.reload();
    } catch {
      setIsRestoring(false);
      addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        variant: 'danger',
      });
    }
  };

  return (
    <Stack
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
      <Stack
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
            <Stack gap="sm" paddingTop="xl">
              <Button variant="primary" onClick={onRestore} disabled={isRestoring}>
                {t('Restore Organization')}
              </Button>
            </Stack>
          )}

          <Text as="p" size="sm" variant="muted">
            {t(
              "Note: Restoration is available until the process begins. Once deletion begins, there's no recovering the data anymore."
            )}
          </Text>
        </Stack>
      </Stack>
    </Stack>
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
