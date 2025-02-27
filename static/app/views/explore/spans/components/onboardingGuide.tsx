import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';

export const TRACES_ONBOARDING_VIEWED_KEY = 'traces-onboarding-guide-viewed';

function TracesOnboardingGuide() {
  return (
    <div>
      <DrawerHeader />
      <DrawerBody />
    </div>
  );
}

export default TracesOnboardingGuide;
