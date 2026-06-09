import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {NotFound} from 'sentry/components/errors/notFound';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SnapshotPrCommentsToggle} from './snapshotPrCommentsToggle';
import {SnapshotStatusChecks} from './snapshotStatusChecks';

export default function SnapshotSettings() {
  const organization = useOrganization();

  if (!organization.features.includes('preprod-snapshots')) {
    return <NotFound />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Snapshots')} />
      <SettingsPageHeader
        marginBottom="xl"
        title={t('Snapshots')}
        subtitle={t('Configure status checks and PR comments for snapshot testing.')}
      />
      <TopBar.Slot name="feedback">
        <FeedbackButton>{null}</FeedbackButton>
      </TopBar.Slot>
      <Stack gap="lg">
        <SnapshotStatusChecks />
        <Feature features="organizations:preprod-snapshot-pr-comments">
          <SnapshotPrCommentsToggle />
        </Feature>
      </Stack>
    </Fragment>
  );
}
