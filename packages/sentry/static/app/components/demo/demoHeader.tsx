import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LogoSentry from 'sentry/components/logoSentry';
import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
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

  return (
    <Wrapper collapsed={collapsed}>
      <StyledLogoSentry />
      <StyledExternalLink
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.demo_click_docs', {organization: null})
        }
        href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
        openInNewTab
      >
        {t('Documentation')}
      </StyledExternalLink>
      <RequestDemoBtn
        priority="form"
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.demo_click_request_demo', {
            organization: null,
          })
        }
        href={urlAttachQueryParams('https://sentry.io/_/demo/', extraSearchParams)}
        target="_blank"
        rel="noreferrer noopener"
      >
        {t('Request a Demo')}
      </RequestDemoBtn>
      <GetStarted
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
        target="_blank"
        rel="noreferrer noopener"
      >
        <GetStartedTextLong>
          {sandboxData?.cta?.title || t('Sign Up for Free')}
        </GetStartedTextLong>
        <GetStartedTextShort>
          {sandboxData?.cta?.shortTitle || t('Sign Up')}
        </GetStartedTextShort>
      </GetStarted>
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

const BaseButton = styled(Button)`
  border-radius: 2rem;
  text-transform: uppercase;
`;

const RequestDemoBtn = styled(BaseButton)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const GetStartedTextShort = styled('span')`
  display: none;
`;

const GetStartedTextLong = styled('span')``;

// Note many of the colors don't come from the theme as they come from the marketing site
const GetStarted = styled(BaseButton)`
  border-color: transparent;
  box-shadow: 0 2px 0 rgb(54 45 89 / 10%);
  background-color: #e1567c;
  color: #fff;
  .short-text {
    display: none;
  }
  @media (max-width: 650px) {
    ${GetStartedTextLong} {
      display: none;
    }
    ${GetStartedTextShort} {
      display: inline;
    }
  }
`;

const StyledExternalLink = styled(ExternalLink)`
  color: #584774;
  @media (max-width: 500px) {
    display: none;
  }
`;
