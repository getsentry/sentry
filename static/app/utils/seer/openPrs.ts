import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {orgHasNewSeerPlan} from './orgHasNewSeerPlan';
import type {SeerAutofixStoppingPoint} from './types';

export const OPEN_PRS_TOOLTIP = t(
  "When Seer spots an issue it can fix, it'll open a PR. You can still run Seer manually when this is off."
);

export function useShowOpenPrs() {
  const organization = useOrganization();
  return (
    organization.features.includes('autofix-single-run') &&
    orgHasNewSeerPlan(organization)
  );
}

export function openPrsStoppingPoint(on: boolean): SeerAutofixStoppingPoint {
  return on ? 'open_pr' : 'off';
}
