import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Button, LinkButton} from 'sentry/components/core/button';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';
import {useDrawerContentContext} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
      <CardContent>
        <BannerTitle>{t('Set Up Feature Flags')}</BannerTitle>
        <BannerDescription>
          {t(
            'Want to know which feature flags were associated with this error? Set up your feature flag integration.'
          )}
        </BannerDescription>
        <ActionButton>
          <Button onClick={handleSetupButtonClick} priority="primary">
            {t('Set Up Now')}
          </Button>
          <LinkButton
            priority="default"
            href="https://docs.sentry.io/product/explore/feature-flags/"
            external
          >
            {t('Read More')}
          </LinkButton>
        </ActionButton>
      </CardContent>
      <BannerIllustration src={onboardingInstall} alt="Install" />
    </BannerWrapper>
  );
}

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 340px;
`;

const ActionButton = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(1)} 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space(1)};
`;

const BannerIllustration = styled('img')`
  height: 100%;
  object-fit: contain;
  max-width: 30%;
  margin-right: 10px;
  margin-bottom: -${space(2)};
  padding: ${space(2)};
`;

const CardContent = styled('div')`
  padding: ${space(2)};

  display: flex;
  flex-direction: column;
  justify-content: center;
`;
