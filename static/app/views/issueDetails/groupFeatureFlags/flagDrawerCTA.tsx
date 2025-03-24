import {
  BannerWrapper,
  FeatureFlagCTAContent,
} from 'sentry/components/events/featureFlags/featureFlagInlineCTA';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';
import {useDrawerContentContext} from 'sentry/components/globalDrawer/components';

export default function FlagDrawerCTA() {
  const {activateSidebar} = useFeatureFlagOnboarding({
    analyticsSurface: 'issue_details.flags_drawer',
  });
  const {onClose: closeDrawer} = useDrawerContentContext();

  function handleSetupButtonClick(e: any) {
    closeDrawer?.();
    setTimeout(() => {
      // Wait for global drawer state to update
      activateSidebar(e);
    }, 100);
  }

  return (
    <BannerWrapper>
      <FeatureFlagCTAContent handleSetupButtonClick={handleSetupButtonClick} />
    </BannerWrapper>
  );
}
