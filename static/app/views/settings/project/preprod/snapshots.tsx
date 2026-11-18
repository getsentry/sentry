import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SnapshotPrCommentsToggle} from './snapshotPrCommentsToggle';
import {SnapshotStatusChecks} from './snapshotStatusChecks';

export default function SnapshotSettings() {
  return (
    <Fragment>
      <SentryDocumentTitle title={t('Snapshots')} />
      <SettingsPageHeader
        title={{
          type: 'page-title',
          label: t('Snapshots'),
          trailingActions: {type: 'badge', element: <FeatureBadge type="beta" />},
        }}
        subtitle={t('Configure status checks and PR comments for snapshot testing.')}
      />
      <Stack gap="lg">
        <SnapshotStatusChecks />
        <SnapshotPrCommentsToggle />
      </Stack>
    </Fragment>
  );
}
