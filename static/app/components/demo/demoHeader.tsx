import {useEffect} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import LogoSentry from 'sentry/components/logoSentry';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  isDemoModeActive,
  urlAttachQueryParams,
} from 'sentry/utils/demoMode';
import {initDemoMode} from 'sentry/utils/demoMode/utils';
import useApi from 'sentry/utils/useApi';

const DEMO_HEADER_HEIGHT_PX = 70;

export default function DemoHeader() {
  const api = useApi();

  useEffect(() => {
    initDemoMode(api);
  }, [api]);

  if (!isDemoModeActive()) {
    return null;
  }

  const extraSearchParams = extraQueryParameter();

  return (
    <Wrapper>
      <StyledLogoSentry />
      <DocsButton
        onClick={() => trackAnalytics('growth.demo_click_docs', {organization: null})}
        href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
        external
      >
        {t('Documentation')}
      </DocsButton>
      <NewRequestDemoBtn
        onClick={() =>
          trackAnalytics('growth.demo_click_request_demo', {organization: null})
        }
        href={urlAttachQueryParams('https://sentry.io/_/demo/', extraSearchParams)}
        external
      >
        {t('Request a Demo')}
      </NewRequestDemoBtn>
      <FreeTrialButton
        priority="primary"
        onClick={() => {
          const url = urlAttachQueryParams(
            'https://sentry.io/signup/',
            extraQueryParameterWithEmail()
          );

          trackAnalytics('growth.demo_click_sign_up', {
            organization: null,
          });

          // Using window.open instead of href={} because we need to read `email`
          // from localStorage when the user clicks the button.
          window.open(url, '_blank');
          // log out the demo user to prevent linking the newly created account to sandbox demo user
          logout(api);
        }}
      >
        <FreeTrialTextLong>{t('Start Free Trial')}</FreeTrialTextLong>
        <FreeTrialTextShort>{t('Sign Up')}</FreeTrialTextShort>
      </FreeTrialButton>
      <SignOutButton
        onClick={() => {
          logout(api);
        }}
        icon={<IconSignOut size="sm" />}
      >
        {t('Exit Sandbox')}
      </SignOutButton>
    </Wrapper>
  );
}

// Note many of the colors don't come from the theme as they come from the marketing site
const Wrapper = styled('div')`
  display: flex;
  height: ${DEMO_HEADER_HEIGHT_PX}px;
  justify-content: space-between;

  align-items: center;
  padding-right: ${space(3)};
  gap: ${space(4)};
  background-color: ${p => p.theme.tokens.background.primary};
  white-space: nowrap;

  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    height: 54px;
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
  fill: ${p => p.theme.tokens.content.primary};
`;

const FreeTrialTextShort = styled('span')`
  display: none;
`;

const FreeTrialTextLong = styled('span')``;

const NewRequestDemoBtn = styled(LinkButton)`
  text-transform: uppercase;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const DocsButton = styled(LinkButton)`
  text-transform: uppercase;
  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    display: none;
  }
`;

const FreeTrialButton = styled(Button)`
  text-transform: uppercase;

  .short-text {
    display: none;
  }
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    ${FreeTrialTextLong} {
      display: none;
    }
    ${FreeTrialTextShort} {
      display: inline;
    }
  }
`;

const SignOutButton = styled(Button)`
  text-transform: uppercase;
`;

const IconSignOut = styled(IconUpload)`
  transform: rotate(90deg);
`;
