import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SnapshotPrCommentsToggle} from './snapshotPrCommentsToggle';
import {SnapshotStatusChecks} from './snapshotStatusChecks';

export default function SnapshotSettings() {
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Snapshots')} />
      <SettingsPageHeader
        title={t('Snapshots')}
        subtitle={t('Configure status checks and PR comments for snapshot testing.')}
      />
      <TopBar.Slot name="feedback">
        <FeedbackButton>{null}</FeedbackButton>
      </TopBar.Slot>
      <Stack gap="lg">
        <SnapshotStatusChecks />
        <SnapshotPrCommentsToggle />
      </Stack>
    </Fragment>
  );
}
