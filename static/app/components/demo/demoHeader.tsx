import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import {LogoSentry} from 'sentry/components/logoSentry';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  isDemoModeActive,
  urlAttachQueryParams,
} from 'sentry/utils/demoMode';
import {initDemoMode} from 'sentry/utils/demoMode/utils';
import {useApi} from 'sentry/utils/useApi';

export function DemoHeader() {
  const api = useApi();

  useEffect(() => {
    initDemoMode(api);
  }, [api]);

  if (!isDemoModeActive()) {
    return null;
  }

  const extraSearchParams = extraQueryParameter();

  return (
    <Wrapper
      height={{zero: '54px', '3xl': '70px'}}
      justify="between"
      align="center"
      paddingRight="2xl"
      gap="3xl"
      background="primary"
      whiteSpace="nowrap"
      borderBottom="primary"
    >
      <StyledLogoSentry />
      <Container display={{zero: 'none', '2xl': 'block'}}>
        {containerProps => (
          <LinkButton
            {...containerProps}
            onClick={() => trackAnalytics('growth.demo_click_docs', {organization: null})}
            href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
            external
          >
            {t('Documentation')}
          </LinkButton>
        )}
      </Container>
      <Container display={{zero: 'none', xl: 'block'}}>
        {containerProps => (
          <LinkButton
            {...containerProps}
            onClick={() =>
              trackAnalytics('growth.demo_click_request_demo', {organization: null})
            }
            href={urlAttachQueryParams('https://sentry.io/_/demo/', extraSearchParams)}
            external
          >
            <Text uppercase>{t('Request a Demo')}</Text>
          </LinkButton>
        )}
      </Container>
      <FreeTrialButton
        variant="primary"
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
const Wrapper = styled(Flex)`
  z-index: ${p => p.theme.zIndex.sidebarPanel - 1};
  box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.05);
`;

const StyledLogoSentry = styled(LogoSentry)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  margin-right: auto;
  width: 130px;
  height: 30px;
  fill: ${p => p.theme.tokens.graphics.neutral.vibrant};
`;

const FreeTrialTextShort = styled('span')`
  display: none;
`;

const FreeTrialTextLong = styled('span')``;

const FreeTrialButton = styled(Button)`
  text-transform: uppercase;

  .short-text {
    display: none;
  }
  @container (max-width: ${p => p.theme.container.xl}) {
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
