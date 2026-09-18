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
      height="53px"
      justify="between"
      align="center"
      paddingRight="xl"
      gap="md"
      background="primary"
      whiteSpace="nowrap"
      borderBottom="primary"
    >
      <StyledLogoSentry />
      <Container display={{zero: 'none', xl: 'contents'}}>
        <LinkButton
          onClick={() => trackAnalytics('growth.demo_click_docs', {organization: null})}
          href={urlAttachQueryParams('https://docs.sentry.io/', extraSearchParams)}
          external
        >
          {t('Documentation')}
        </LinkButton>
        <LinkButton
          onClick={() =>
            trackAnalytics('growth.demo_click_request_demo', {organization: null})
          }
          href={urlAttachQueryParams('https://sentry.io/_/demo/', extraSearchParams)}
          external
        >
          <Text>{t('Request demo')}</Text>
        </LinkButton>
      </Container>
      <SignOutButton
        onClick={() => {
          logout(api);
        }}
      >
        {t('Exit Sandbox')}
      </SignOutButton>
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
        <FreeTrialTextLong>{t('Start free trial')}</FreeTrialTextLong>
        <FreeTrialTextShort>{t('Start trial')}</FreeTrialTextShort>
      </FreeTrialButton>
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

const SignOutButton = styled(Button)``;

const IconSignOut = styled(IconUpload)`
  transform: rotate(90deg);
`;
