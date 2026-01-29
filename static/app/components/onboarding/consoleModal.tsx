import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
import {PlatformIcon} from 'platformicons';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import ExternalLink from 'sentry/components/links/externalLink';
import {ConsolePlatform} from 'sentry/constants/consolePlatforms';
import {t, tct} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

export const CONSOLE_PLATFORM_INSTRUCTIONS = {
  [ConsolePlatform.PLAYSTATION]: (
    <Flex direction="column" gap="md">
      <p>
        {t(
          'You can get started using Sentry on PlayStation without any changes to your game, on DevKits as well as Retail devices.'
        )}
      </p>
      <p>
        {tct(
          'Please complete the verification process on the [partnersWebsiteLink:PlayStation Partners website] and confirm your developer status by clicking on [italic:Confirm status].',
          {
            partnersWebsiteLink: (
              <ExternalLink href="https://game.develop.playstation.net/tm/verify/functionalsw" />
            ),
            italic: <i />,
          }
        )}
      </p>
      <p>{t("We'll receive your request and get back to you with the next steps.")}</p>
    </Flex>
  ),
  [ConsolePlatform.NINTENDO_SWITCH]: (
    <Flex direction="column" gap="md">
      <p>
        {t(
          'You can get started using Sentry on Nintendo Switch without any changes to your game, on DevKits as well as Retail devices.'
        )}
      </p>
      <p>
        {tct(
          "Please complete the verification process by submitting an access request to the [nintendoDeveloperAuthorizationFormLink: Nintendo Developer Authorization form] and configure Nintendo's CRPORTAL to forward crashes to Sentry using [lp1Link:lp1 for retail devices] or [dd1Link:dd1 for devkits].",
          {
            nintendoDeveloperAuthorizationFormLink: (
              <ExternalLink href="https://developer.nintendo.com/group/development/getting-started/g1kr9vj6/middleware/sentry" />
            ),
            lp1Link: (
              <ExternalLink href="https://crash-report.wc.lp1.er.srv.nintendo.net/sentry/get_started" />
            ),
            dd1Link: (
              <ExternalLink href="https://crash-report.wc.dd1.er.srv.nintendo.net/sentry/get_started" />
            ),
          }
        )}
      </p>
      <p>{t("We'll receive your request and get back to you with the next steps.")}</p>
      <Alert variant="info" showIcon>
        {t('Sentry supports both the original Switch and Switch 2.')}
      </Alert>
    </Flex>
  ),
  [ConsolePlatform.XBOX]: (
    <Flex direction="column" gap="md">
      <p>
        {t(
          'Sentry supports Xbox One and Series X|S, across both DevKits and Retail devices through an SDK.'
        )}
      </p>
      <p>
        {tct(
          'Please complete the verification process by requesting access to the [microsoftGameDevelopmentKitLink:Microsoft Game Development Kit (GDK) Middleware].',
          {
            microsoftGameDevelopmentKitLink: (
              <ExternalLink href="https://developer.microsoft.com/en-us/games/support/request-gdkx-middleware" />
            ),
          }
        )}
      </p>
      <p>{t("We'll receive your request and get back to you with the next steps.")}</p>
    </Flex>
  ),
};

export interface ConsoleModalProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation';
  selectedPlatform: OnboardingSelectedSDK;
}

export function ConsoleModal({
  Body,
  Header,
  Footer,
  selectedPlatform,
  closeModal,
  organization,
  origin,
}: ConsoleModalProps & ModalRenderProps) {
  const platformKey = selectedPlatform.key;
  const config = CONSOLE_PLATFORM_INSTRUCTIONS[platformKey as ConsolePlatform];

  useEffect(() => {
    trackAnalytics('gaming.partner_request_access_guidance_modal_opened', {
      platform: selectedPlatform.key,
      organization,
      origin,
    });
  }, [selectedPlatform.key, organization, origin]);

  if (!config) {
    return null;
  }

  return (
    <Fragment>
      <Header closeButton>
        <Flex align="center" gap="xl">
          <PlatformIcon size={32} format="lg" platform={selectedPlatform.key} />
          <Heading as="h5">{t('Request Access for %s', selectedPlatform.name)}</Heading>
        </Flex>
      </Header>
      <Body>{config}</Body>
      <Footer>
        <Button
          priority="primary"
          onClick={() => {
            trackAnalytics(
              'gaming.partner_request_access_guidance_modal_button_got_it_clicked',
              {
                platform: selectedPlatform.key,
                organization,
                origin,
              }
            );
            closeModal();
          }}
        >
          {t('Got it')}
        </Button>
      </Footer>
    </Fragment>
  );
}

export const modalCss = css`
  max-width: 600px;
  width: 100%;
`;
