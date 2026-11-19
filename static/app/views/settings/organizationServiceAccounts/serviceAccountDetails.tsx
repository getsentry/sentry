import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {DateTime} from '@sentry/scraps/dateTime';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {serviceAccountApiOptions} from './serviceAccountApi';
import {ServiceAccountOwnerKind} from './serviceAccountOwnerKind';
import {
  PermissionCount,
  ServiceAccountPermissionTable,
} from './serviceAccountPermissionTable';
import {ProjectAccessBadges} from './serviceAccountProjectAccess';

function Detail({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="xs" minWidth="0">
      <Text bold>{label}</Text>
      {children}
    </Stack>
  );
}

export default function ServiceAccountDetails() {
  const organization = useOrganization();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();
  const {
    data: account,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountApiOptions(organization, serviceAccountId));

  if (isError) {
    return (
      <LoadingError message={t('Failed to load service account.')} onRetry={refetch} />
    );
  }
  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={account.name} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={account.name}
        subtitle={
          account.ownerKind === 'seer_workflow_config'
            ? t(
                'This account belongs to a Seer automation. Change its access from the automation.'
              )
            : undefined
        }
      />
      <Stack gap="2xl">
        <Grid columns={{zero: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))'}} gap="xl">
          <Detail label={t('Owner')}>
            <ServiceAccountOwnerKind ownerKind={account.ownerKind} />
          </Detail>
          <Detail label={t('Permissions')}>
            <PermissionCount scopes={account.scopes} />
          </Detail>
          <Detail label={t('Project access')}>
            <ProjectAccessBadges account={account} />
          </Detail>
          <Detail label={t('Created')}>
            <Text>
              <DateTime date={account.dateCreated} mode="date" year="always" />
            </Text>
          </Detail>
        </Grid>

        <Stack gap="lg">
          <Heading as="h3">{t('Permissions')}</Heading>
          <ServiceAccountPermissionTable scopes={account.scopes} />
        </Stack>
      </Stack>
    </Fragment>
  );
}
