import {startTransition, useCallback} from 'react';
import type {LocationDescriptor, LocationDescriptorObject} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * Use this hook to sync a local state in the URL.
 * As the URL update is deferred, the UI will feel more responsive.
 * It allows the local state to be updated immediately and delays the full page render caused by the URL update.
 * @returns
 */
export function useTransitionedLocationUpdate() {
  const navigate = useNavigate();
  const location = useLocation();
  const updateLocation = useCallback(
    (updater: (query: LocationDescriptorObject) => LocationDescriptor) => {
      startTransition(() => {
        navigate(updater(location), {replace: true, preventScrollReset: true});
      });
    },
    [navigate, location]
  );
  return updateLocation;
}
