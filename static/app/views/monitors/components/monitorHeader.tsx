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
}

export function MonitorHeader({monitor, orgSlug, onUpdate}: Props) {
  const crumbs = [
    {
      label: t('Crons'),
      to: `/organizations/${orgSlug}/crons/`,
      preservePageFilters: true,
    },
    {
      label: t('Cron Monitor Details'),
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
        <MonitorHeaderActions orgSlug={orgSlug} monitor={monitor} onUpdate={onUpdate} />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
