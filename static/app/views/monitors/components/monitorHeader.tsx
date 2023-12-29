import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

import {Monitor} from '../types';

import MonitorHeaderActions from './monitorHeaderActions';

interface Props {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgId: string;
}

function MonitorHeader({monitor, orgId, onUpdate}: Props) {
  const crumbs = [
    {
      label: t('Crons'),
      to: `/organizations/${orgId}/crons/`,
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
        <MonitorHeaderActions orgId={orgId} monitor={monitor} onUpdate={onUpdate} />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default MonitorHeader;
