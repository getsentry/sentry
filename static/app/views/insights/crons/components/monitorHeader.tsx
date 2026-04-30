import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {IdBadge} from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {Monitor} from 'sentry/views/insights/crons/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {MonitorHeaderActions} from './monitorHeaderActions';

interface Props {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgSlug: string;
}

export function MonitorHeader({monitor, orgSlug, onUpdate}: Props) {
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();
  const crumbs = [
    {
      label: t('Alerts'),
      to: makeAlertsPathname({path: '/rules/', organization}),
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
      {hasPageFrameFeature ? (
        <TopBar.Slot name="actions">
          <MonitorHeaderActions orgSlug={orgSlug} monitor={monitor} onUpdate={onUpdate} />
        </TopBar.Slot>
      ) : (
        <Layout.HeaderActions>
          <MonitorHeaderActions orgSlug={orgSlug} monitor={monitor} onUpdate={onUpdate} />
        </Layout.HeaderActions>
      )}
    </Layout.Header>
  );
}
