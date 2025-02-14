import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

import type {Monitor} from '../types';

import MonitorHeaderActions from './monitorHeaderActions';

interface Props {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgSlug: string;
  /**
   * TODO(epurkhiser): Remove once crons exists only in alerts
   */
  linkToAlerts?: boolean;
}

export function MonitorHeader({monitor, orgSlug, onUpdate, linkToAlerts}: Props) {
  const crumbs = [
    {
      label: linkToAlerts ? t('Alerts') : t('Crons'),
      to: linkToAlerts
        ? `/organizations/${orgSlug}/alerts/rules/`
        : `/organizations/${orgSlug}/crons/`,
      preservePageFilters: true,
    },
    {
      label: t('Cron Monitor'),
    },
  ];

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>
          <IdBadge
            project={monitor.project}
            avatarSize={28}
            hideName
            avatarProps={{hasTooltip: true, tooltip: monitor.project.slug}}
          />
          {monitor.name}
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <MonitorHeaderActions
          linkToAlerts={linkToAlerts}
          orgSlug={orgSlug}
          monitor={monitor}
          onUpdate={onUpdate}
        />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
