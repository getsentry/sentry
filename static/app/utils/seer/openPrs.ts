import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {SeerAutofixStoppingPoint} from './types';

export const OPEN_PRS_TOOLTIP = t(
  'When Seer finds a fix, it opens a PR. You can still ask Seer to open a PR when this is off.'
);

export function useShowOpenPrs() {
  const organization = useOrganization();
  return organization.features.includes('autofix-single-run');
}

export function openPrsStoppingPoint(on: boolean): SeerAutofixStoppingPoint {
  return on ? 'open_pr' : 'off';
}
