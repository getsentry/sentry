import {Fragment, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StatusPageIncidentUpdate, StatuspageIncident} from 'sentry/types/system';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';
import {
  PrimaryNavigation,
  usePrimaryNavigationButtonOverlay,
} from 'sentry/views/navigation/primary/components';

type IndicatorVariant = 'accent' | 'danger' | 'warning' | 'success';

/**
 * Map an incident update status to a {@link PrimaryNavigation.Button}
 * indicator variant. The variants here intentionally mirror the colors used
 * for the timeline bullet in {@link ServiceIncidentDetails} so that the nav
 * indicator matches the latest status update visible inside the overlay.
 */
function statusToIndicatorVariant(
  status: StatusPageIncidentUpdate['status']
): IndicatorVariant {
  switch (status) {
    case 'investigating':
      return 'danger';
    case 'identified':
      return 'accent';
    case 'monitoring':
      return 'warning';
    case 'resolved':
      return 'success';
    default:
      return 'danger';
  }
}

/**
 * Returns the most recent {@link StatusPageIncidentUpdate} across all of the
 * provided incidents (sorted by display/created time).
 */
function getLatestUpdate(
  incidents: StatuspageIncident[]
): StatusPageIncidentUpdate | undefined {
  let latest: StatusPageIncidentUpdate | undefined;
  let latestTime = -Infinity;

  for (const incident of incidents) {
    for (const update of incident.incident_updates) {
      const time = new Date(update.display_at ?? update.created_at).getTime();
      if (Number.isFinite(time) && time > latestTime) {
        latestTime = time;
        latest = update;
      }
    }
  }

  return latest;
}

function ServiceIncidentsButton({incidents}: {incidents: StatuspageIncident[]}) {
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryNavigationButtonOverlay();

  const indicator = useMemo<IndicatorVariant>(() => {
    const latestUpdate = getLatestUpdate(incidents);
    return latestUpdate ? statusToIndicatorVariant(latestUpdate.status) : 'danger';
  }, [incidents]);

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="statusupdate"
        label={t('Service status')}
        indicator={indicator}
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconFire />,
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
