import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';
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

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="statusupdate"
        label={t('Service status')}
        indicator="danger"
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconFire />,
          size: 'sm',
        }}
      />
      {isOpen && (
        <PrimaryNavigation.ButtonOverlay overlayProps={overlayProps}>
          <Stack as="ul" padding="0" gap="md">
            {incidents.map(incident => (
              <Stack key={incident.id} as="li">
                <ServiceIncidentDetails incident={incident} />
              </Stack>
            ))}
          </Stack>
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
