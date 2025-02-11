import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import LogoSentry from 'sentry/components/logoSentry';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MOBILE_HEIGHT,
} from 'sentry/components/sidebar';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  isDemoModeEnabled,
  openDemoEmailModal,
  urlAttachQueryParams,
} from 'sentry/utils/demoMode';

export const DEMO_HEADER_HEIGHT_PX = 70;

export default function DemoHeader() {
  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;

  useEffect(() => {
    openDemoEmailModal();
  }, []);

  if (!isDemoModeEnabled()) {
    return null;
  }

  // if the user came from a SaaS org, we should send them back to upgrade when they leave the sandbox
  const extraSearchParams = extraQueryParameter();

  const docsBtn = (
    <DocsDemoBtn
      onClick={() => trackAnalytics('growth.demo_click_docs', {organization: null})}
      href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
      external
    >
      {t('Documentation')}
    </DocsDemoBtn>
  );

  const reqDemoBtn = (
    <NewRequestDemoBtn
      onClick={() =>
        trackAnalytics('growth.demo_click_request_demo', {
          organization: null,
        })
      }
      href={urlAttachQueryParams('https://sentry.io/_/demo/', extraSearchParams)}
      external
    >
      {t('Request a Demo')}
    </NewRequestDemoBtn>
  );

  const signUpBtn = (
    <FreeTrial
      onClick={() => {
        const url = urlAttachQueryParams(
          'https://sentry.io/signup/',
          extraQueryParameterWithEmail()
        );

        // Using window.open instead of href={} because we need to read `email`
        // from localStorage when the user clicks the button.
        window.open(url, '_blank');

        trackAnalytics('growth.demo_click_get_started', {
          cta: undefined,
          organization: null,
        });
      }}
    >
      <FreeTrialTextLong>{t('Start Free Trial')}</FreeTrialTextLong>
      <FreeTrialTextShort>{t('Sign Up')}</FreeTrialTextShort>
    </FreeTrial>
  );

  return (
    <Wrapper collapsed={collapsed}>
      <StyledLogoSentry />
      {docsBtn}
      {reqDemoBtn}
      {signUpBtn}
    </Wrapper>
  );
}

// Note many of the colors don't come from the theme as they come from the marketing site
const Wrapper = styled('div')<{collapsed: boolean}>`
  padding-right: ${space(3)};
  background-color: ${p => p.theme.white};
  height: ${DEMO_HEADER_HEIGHT_PX}px;
  display: flex;
  justify-content: space-between;
  text-transform: uppercase;
  align-items: center;
  white-space: nowrap;
  gap: ${space(4)};

  margin-left: calc(
    -1 * ${p => (p.collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH)}
  );

  position: fixed;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    height: ${SIDEBAR_MOBILE_HEIGHT};
    margin-left: 0;
  }
`;

const StyledLogoSentry = styled(LogoSentry)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  margin-right: auto;
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const FreeTrialTextShort = styled('span')`
  display: none;
`;

const FreeTrialTextLong = styled('span')``;

const NewRequestDemoBtn = styled(LinkButton)`
  text-transform: uppercase;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const DocsDemoBtn = styled(LinkButton)`
  text-transform: uppercase;
  @media (max-width: 500px) {
    display: none;
  }
`;

const FreeTrial = styled(Button)`
  text-transform: uppercase;
  border-color: transparent;
  background-color: #6c5fc7;
  color: #fff;
  .short-text {
    display: none;
  }
  @media (max-width: 650px) {
    ${FreeTrialTextLong} {
      display: none;
    }
    ${FreeTrialTextShort} {
      display: inline;
    }
  }
`;
