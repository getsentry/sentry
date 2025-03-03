import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import useOrganization from 'sentry/utils/useOrganization';

export const TRACES_ONBOARDING_VIEWED_KEY = 'traces-onboarding-guide-viewed';

function TracesOnboardingGuide() {
  const organization = useOrganization();

  return organization.features.includes('traces-onboarding-guide') ? (
    <div>
      <DrawerHeader />
      <DrawerBody />
    </div>
  ) : null;
}

export default TracesOnboardingGuide;
