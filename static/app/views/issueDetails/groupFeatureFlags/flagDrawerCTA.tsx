import {
  BannerWrapper,
  FeatureFlagCTAContent,
} from 'sentry/components/events/featureFlags/featureFlagInlineCTA';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';
import {useDrawerContentContext} from 'sentry/components/globalDrawer/components';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function FlagDrawerCTA() {
  const organization = useOrganization();
  const {activateSidebar} = useFeatureFlagOnboarding();
  const {onClose: closeDrawer} = useDrawerContentContext();

  function handleSetupButtonClick(e: any) {
    trackAnalytics('flags.setup_sidebar_opened', {
      organization,
      surface: 'issue_details.flags_drawer',
    });
    trackAnalytics('flags.cta_setup_button_clicked', {organization});
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
