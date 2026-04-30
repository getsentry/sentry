import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Redirect} from 'sentry/components/redirect';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SeerAutomationOnboarding as SeerOnboardingLegacy} from './onboardingLegacy';
import {SeerOnboardingSeatBased} from './onboardingSeatBased';

/**
 * Depending on user's billing, will show either the legacy onboarding, or the newer, seat-based onboarding.
 */
export default function SeerOnboarding() {
  const organization = useOrganization();

  if (showNewSeer(organization)) {
    if (organization.features.includes('seer-wizard')) {
      return (
        <AnalyticsArea name="onboarding">
          <SeerOnboardingSeatBased />
        </AnalyticsArea>
      );
    }
    return <Redirect to={normalizeUrl(`/settings/${organization.slug}/seer/`)} />;
  }

  return (
    <AnalyticsArea name="onboarding">
      <SeerOnboardingLegacy />
    </AnalyticsArea>
  );
}
