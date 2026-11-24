import {useOrganization} from 'sentry/utils/useOrganization';

import type {SeerAutofixStoppingPoint} from './types';

export function useShowOpenPrs() {
  const organization = useOrganization();
  return organization.features.includes('autofix-single-run');
}

export function openPrsStoppingPoint(on: boolean): SeerAutofixStoppingPoint {
  return on ? 'open_pr' : 'off';
}
