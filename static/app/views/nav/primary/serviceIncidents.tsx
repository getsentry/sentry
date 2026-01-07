import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';
import {NavLayout} from 'sentry/views/nav/types';

function ServiceIncidentsButton({incidents}: {incidents: StatuspageIncident[]}) {
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

  const {layout} = useNavContext();

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="statusupdate"
        label={t('Service status')}
        buttonProps={overlayTriggerProps}
      >
        <IconFire />
        <DangerUnreadIndicator isMobile={layout === NavLayout.MOBILE} />
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
  background: ${p => p.theme.tokens.background.primary};
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const DangerUnreadIndicator = styled(SidebarItemUnreadIndicator)`
  background: ${p => p.theme.danger};
`;
