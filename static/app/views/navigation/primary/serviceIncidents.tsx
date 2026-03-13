import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';
import {useNavigation} from 'sentry/views/navigation/navigationContext';
import {
  PrimaryNavigation,
  usePrimaryNavigationButtonOverlay,
} from 'sentry/views/navigation/primary/components';

function ServiceIncidentsButton({incidents}: {incidents: StatuspageIncident[]}) {
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryNavigationButtonOverlay();

  const {layout} = useNavigation();

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="statusupdate"
        label={t('Service status')}
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconFire />,
          size: 'sm',
        }}
      >
        <PrimaryNavigation.UnreadIndicator
          isMobile={layout === 'mobile'}
          variant="danger"
        />
      </PrimaryNavigation.Button>
      {isOpen && (
        <PrimaryNavigation.ButtonOverlay overlayProps={overlayProps}>
          {incidents.map(incident => (
            <IncidentItemWrapper key={incident.id}>
              <ServiceIncidentDetails incident={incident} />
            </IncidentItemWrapper>
          ))}
        </PrimaryNavigation.ButtonOverlay>
      )}
    </Fragment>
  );
}
export function PrimaryNavigationServiceIncidents() {
  const {data: incidents = []} = useServiceIncidents();

  if (!incidents?.length) {
    return null;
  }

  return <ServiceIncidentsButton incidents={incidents} />;
}

const IncidentItemWrapper = styled('div')`
  line-height: 1.5;
  background: ${p => p.theme.tokens.background.primary};
  font-size: ${p => p.theme.font.size.md};
  padding: ${p => p.theme.space['2xl']};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
