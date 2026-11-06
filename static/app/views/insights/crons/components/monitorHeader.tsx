import {Fragment} from 'react';

import {IdBadge} from 'sentry/components/idBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import type {Monitor} from 'sentry/views/insights/crons/types';
import {TopBar} from 'sentry/views/navigation/topBar';

import {MonitorHeaderActions} from './monitorHeaderActions';

interface Props {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgSlug: string;
}

export function MonitorHeader({monitor, orgSlug, onUpdate}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const selectionQuery = extractSelectionParameters(location.query);

  return (
    <Fragment>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: monitor.name,
          leadingGraphic: (
            <IdBadge project={monitor.project} avatarSize={16} hideName disableLink />
          ),
        }}
        items={[
          {
            type: 'link',
            label: t('Monitors'),
            to: {
              pathname: makeMonitorBasePathname(organization.slug),
              query: selectionQuery,
            },
          },
          {
            type: 'link',
            label: t('Cron Monitors'),
            to: {
              pathname: makeMonitorTypePathname(
                organization.slug,
                'monitor_check_in_failure'
              ),
              query: selectionQuery,
            },
          },
        ]}
      />
      <TopBar.Slot name="actions">
        <MonitorHeaderActions orgSlug={orgSlug} monitor={monitor} onUpdate={onUpdate} />
      </TopBar.Slot>
    </Fragment>
  );
}
