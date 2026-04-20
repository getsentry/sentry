import {Fragment} from 'react';

import {Grid, Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {NotFound} from 'sentry/components/errors/notFound';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SnapshotPrCommentsToggle} from './snapshotPrCommentsToggle';
import {SnapshotStatusChecks} from './snapshotStatusChecks';

export default function SnapshotSettings() {
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();

  if (!organization.features.includes('preprod-snapshots')) {
    return <NotFound />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Snapshots')} />
      <SettingsPageHeader
        title={t('Snapshots')}
        subtitle={t('Configure status checks and PR comments for snapshot testing.')}
        action={
          <Grid flow="column" align="center" gap="lg">
            {hasPageFrameFeature ? (
              <TopBar.Slot name="feedback">
                <FeedbackButton>{null}</FeedbackButton>
              </TopBar.Slot>
            ) : (
              <FeedbackButton />
            )}
          </Grid>
        }
      />
      <Stack gap="lg">
        <SnapshotStatusChecks />
        <Feature features="organizations:preprod-snapshot-pr-comments">
          <SnapshotPrCommentsToggle />
        </Feature>
      </Stack>
    </Fragment>
  );
}
