import FeatureFlagCTAContent, {
  BannerWrapper,
} from 'sentry/components/events/featureFlags/cta/featureFlagCTAContent';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/onboarding/useFeatureFlagOnboarding';
import {useDrawerContentContext} from 'sentry/components/globalDrawer/components';
import type {PlatformKey} from 'sentry/types/project';

export default function FlagDrawerCTA({
  projectPlatform,
}: {
  projectPlatform?: PlatformKey;
}) {
  const {activateSidebar} = useFeatureFlagOnboarding({projectPlatform});
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
