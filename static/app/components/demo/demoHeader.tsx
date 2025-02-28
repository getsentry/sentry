import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import LogoSentry from 'sentry/components/logoSentry';
import {SIDEBAR_MOBILE_HEIGHT} from 'sentry/components/sidebar/constants';
import {t} from 'sentry/locale';
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
  useEffect(() => {
    openDemoEmailModal();
  }, []);

  if (!isDemoModeEnabled()) {
    return null;
  }

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
      priority="primary"
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
    <Wrapper>
      <StyledLogoSentry />
      {docsBtn}
      {reqDemoBtn}
      {signUpBtn}
    </Wrapper>
  );
}

// Note many of the colors don't come from the theme as they come from the marketing site
const Wrapper = styled('div')`
  display: flex;
  height: ${DEMO_HEADER_HEIGHT_PX}px;
  justify-content: space-between;
  text-transform: uppercase;
  align-items: center;
  padding-right: ${space(3)};
  gap: ${space(4)};
  background-color: ${p => p.theme.backgroundElevated};
  white-space: nowrap;

  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    height: ${SIDEBAR_MOBILE_HEIGHT};
    margin-left: 0;
  }

  box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.05);
`;

const StyledLogoSentry = styled(LogoSentry)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  margin-right: auto;
  width: 130px;
  height: 30px;
  fill: ${p => p.theme.textColor};
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
