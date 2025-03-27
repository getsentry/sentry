import {Fragment} from 'react';
import styled from '@emotion/styled';

import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/components/nav/primary/primaryButtonOverlay';
import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';

function ServiceIncidentsButton({incidents}: {incidents: StatuspageIncident[]}) {
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="statusupdate"
        label={t('Service status')}
        buttonProps={overlayTriggerProps}
      >
        <IconFire />
        <DangerUnreadIndicator />
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          {incidents.map(incident => (
            <IncidentItemWrapper key={incident.id}>
              <ServiceIncidentDetails incident={incident} />
            </IncidentItemWrapper>
          ))}
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}
export function PrimaryNavigationServiceIncidents() {
  const {data: incidents = []} = useServiceIncidents();

  if (!incidents || incidents.length === 0) {
    return null;
  }

  return <ServiceIncidentsButton incidents={incidents} />;
}

const IncidentItemWrapper = styled('div')`
  line-height: 1.5;
  background: ${p => p.theme.background};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DangerUnreadIndicator = styled(SidebarItemUnreadIndicator)`
  background: ${p => p.theme.danger};
`;
