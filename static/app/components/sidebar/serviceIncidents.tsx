import {Fragment} from 'react';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';

import {ServiceIncidentDetails} from '../serviceIncidentDetails';

import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';
import SidebarPanelEmpty from './sidebarPanelEmpty';
import SidebarPanelItem from './sidebarPanelItem';
import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

type Props = CommonSidebarProps;

function ServiceIncidents({
  currentPanel,
  onShowPanel,
  hidePanel,
  collapsed,
  orientation,
}: Props) {
  const {data: incidents} = useServiceIncidents();

  if (!incidents) {
    return null;
  }

  const active = currentPanel === SidebarPanelKey.SERVICE_INCIDENTS;
  const isEmpty = !incidents || incidents.length === 0;

  if (isEmpty) {
    return null;
  }

  return (
    <Fragment>
      <SidebarItem
        id="statusupdate"
        orientation={orientation}
        collapsed={collapsed}
        active={active}
        badge={incidents.length}
        icon={<IconWarning size="md" />}
        label={t('Service status')}
        onClick={onShowPanel}
      />
      {active && incidents && (
        <SidebarPanel
          orientation={orientation}
          title={t('Recent service updates')}
          hidePanel={hidePanel}
          collapsed={collapsed}
        >
          {isEmpty && (
            <SidebarPanelEmpty>{t('There are no incidents to report')}</SidebarPanelEmpty>
          )}
          {incidents.map(incident => (
            <SidebarPanelItem key={incident.id}>
              <ServiceIncidentDetails incident={incident} />
            </SidebarPanelItem>
          ))}
        </SidebarPanel>
      )}
    </Fragment>
  );
}

export default ServiceIncidents;
