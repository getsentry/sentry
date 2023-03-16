import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import LogoSentry from 'sentry/components/logoSentry';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  urlAttachQueryParams,
} from 'sentry/utils/demoMode';

export default function DemoHeader() {
  const sandboxData = window.SandboxData;
  // if the user came from a SaaS org, we should send them back to upgrade when they leave the sandbox
  const extraSearchParams = extraQueryParameter();

  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;

  const docsBtn = (
    <DocsDemoBtn
      onClick={() =>
        trackAdvancedAnalyticsEvent('growth.demo_click_docs', {organization: null})
      }
      href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
      external
    >
      {t('Documentation')}
    </DocsDemoBtn>
  );

  const reqDemoBtn = (
    <NewRequestDemoBtn
      onClick={() =>
        trackAdvancedAnalyticsEvent('growth.demo_click_request_demo', {
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
        const url =
          sandboxData?.cta?.url ||
          urlAttachQueryParams(
            'https://sentry.io/signup/',
            extraQueryParameterWithEmail()
          );

        // Using window.open instead of href={} because we need to read `email`
        // from localStorage when the user clicks the button.
        window.open(url, '_blank');

        trackAdvancedAnalyticsEvent('growth.demo_click_get_started', {
          cta: sandboxData?.cta?.id,
          organization: null,
        });
      }}
    >
      <FreeTrialTextLong>
        {sandboxData?.cta?.title || t('Start Free Trial')}
      </FreeTrialTextLong>
      <FreeTrialTextShort>
        {sandboxData?.cta?.shortTitle || t('Sign Up')}
      </FreeTrialTextShort>
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
  height: ${p => p.theme.demo.headerSize};
  display: flex;
  justify-content: space-between;
  text-transform: uppercase;
  align-items: center;
  white-space: nowrap;
  gap: ${space(4)};

  margin-left: calc(
    -1 * ${p => (p.collapsed ? p.theme.sidebar.collapsedWidth : p.theme.sidebar.expandedWidth)}
  );

  position: fixed;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    height: ${p => p.theme.sidebar.mobileHeight};
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

const NewBaseButton = styled(Button)`
  text-transform: uppercase;
`;

const NewRequestDemoBtn = styled(NewBaseButton)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const DocsDemoBtn = styled(NewBaseButton)`
  @media (max-width: 500px) {
    display: none;
  }
`;

const FreeTrial = styled(NewBaseButton)`
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
