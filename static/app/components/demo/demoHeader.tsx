import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import LogoSentry from 'app/components/logoSentry';
import {t} from 'app/locale';
import PreferencesStore from 'app/stores/preferencesStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import space from 'app/styles/space';
import trackAdvancedAnalyticsEvent from 'app/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  urlAttachQueryParams,
} from 'app/utils/demoMode';
import getCookie from 'app/utils/getCookie';

export default function DemoHeader() {
  // if the user came from a SaaS org, we should send them back to upgrade when they leave the sandbox
  const saasOrgSlug = getCookie('saas_org_slug');

  const extraSearchParams = extraQueryParameter();

  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;

  // Docs link: https://docs.sentry.io/extraQueryParameter(false)
  // Request Demo: https://docs.sentry.io/extraQueryParameter(false)
  // Get started: if saasOrgSlug, https://sentry.io/settings/${saasOrgSlug}/billing/checkout/
  // else https://sentry.io/signup/emailQueryParameter()extraQueryParameter(true)
  return (
    <Wrapper collapsed={collapsed}>
      <StyledLogoSentry />
      <ButtonBar gap={4}>
        <StyledExternalLink
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.demo_click_docs', {organization: null})
          }
          href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
          openInNewTab
        >
          {t('Documentation')}
        </StyledExternalLink>
        <BaseButton
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
        </BaseButton>
        <GetStarted
          onClick={() => {
            const url = saasOrgSlug
              ? `https://sentry.io/settings/${saasOrgSlug}/billing/checkout/`
              : urlAttachQueryParams(
                  'https://sentry.io/signup/',
                  extraQueryParameterWithEmail()
                );

            window.open(url, '_blank');

            trackAdvancedAnalyticsEvent('growth.demo_click_get_started', {
              is_upgrade: !!saasOrgSlug,
              organization: null,
            });
          }}
          target="_blank"
          rel="noreferrer noopener"
        >
          {saasOrgSlug ? t('Upgrade Now') : t('Sign Up for Free')}
        </GetStarted>
      </ButtonBar>
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

  margin-left: calc(
    -1 * ${p => (p.collapsed ? p.theme.sidebar.collapsedWidth : p.theme.sidebar.expandedWidth)}
  );

  position: fixed;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    height: ${p => p.theme.sidebar.mobileHeight};
    margin-left: 0;
  }
`;

const StyledLogoSentry = styled(LogoSentry)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const BaseButton = styled(Button)`
  border-radius: 2rem;
  text-transform: uppercase;
`;

// Note many of the colors don't come from the theme as they come from the marketing site
const GetStarted = styled(BaseButton)`
  border-color: transparent;
  box-shadow: 0 2px 0 rgb(54 45 89 / 10%);
  background-color: #e1567c;
  color: #fff;
`;

const StyledExternalLink = styled(ExternalLink)`
  color: #584774;
`;
