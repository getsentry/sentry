import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
import {PlatformIcon} from 'platformicons';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
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
    <Fragment>
      <p>
        {t(
          'You can get started using Sentry on PlayStation without any changes to your game, on devkits as well as retail devices.'
        )}
      </p>
      <p>
        {tct(
          "Please complete the verification process on the [partnersWebsiteLink:PlayStation Partners website] and confirm your developer status by clicking on [italic:Confirm status]. We'll receive your request and get back to you with the next steps.",
          {
            partnersWebsiteLink: (
              <ExternalLink href="https://game.develop.playstation.net/tm/verify/functionalsw" />
            ),
            italic: <i />,
          }
        )}
      </p>
    </Fragment>
  ),
  [ConsolePlatform.NINTENDO_SWITCH]: (
    <Fragment>
      <p>
        {tct(
          "You can get started using Sentry on Nintendo Switch without any changes to your game, on devkits as well as retail devices. You can configure Nintendo's CRPORTAL to forward crashes to Sentry using [lp1Link:lp1 for retail devices] or [dd1Link:dd1 for devkits].",
          {
            lp1Link: (
              <ExternalLink href="https://crash-report.wc.lp1.er.srv.nintendo.net/sentry/get_started" />
            ),
            dd1Link: (
              <ExternalLink href="https://crash-report.wc.dd1.er.srv.nintendo.net/sentry/get_started" />
            ),
          }
        )}
      </p>
      <Heading as="h4">Nintendo Switch SDK</Heading>
      <p>
        {tct(
          'To add more context to your crash dumps or capture non-fatal events, Sentry provides a dedicated SDK for Nintendo Switch. With this SDK, you can include details like [breadcrumbsLink:breadcrumbs] and [tagsLink:tags]. To request access, please use the [nintendoDeveloperAuthorizationFormLink:Nintendo Developer Authorization form].',
          {
            nintendoDeveloperAuthorizationFormLink: (
              <ExternalLink href="https://developer.nintendo.com/group/development/getting-started/g1kr9vj6/middleware/sentry" />
            ),
            breadcrumbsLink: (
              <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/breadcrumbs/" />
            ),
            tagsLink: (
              <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#tags" />
            ),
          }
        )}
      </p>
      <p>{t('Sentry supports both the original Switch and Switch 2.')}</p>
    </Fragment>
  ),
  [ConsolePlatform.XBOX]: (
    <Fragment>
      <p>
        {t('Sentry supports Xbox One and Series X|S, devkits as well as retail devices.')}
      </p>
      <p>
        {tct(
          'You can get started with Sentry by [microsoftGameDevelopmentKitLink: requesting access to the Microsoft Game Development Kit (GDK) Middleware]. We will get back to you with the next steps as soon as we receive your request.',
          {
            microsoftGameDevelopmentKitLink: (
              <ExternalLink href="https://developer.microsoft.com/en-us/games/support/request-gdkx-middleware" />
            ),
          }
        )}
      </p>
    </Fragment>
  ),
};

export interface ConsoleModalProps {
  organization: Organization;
  selectedPlatform: OnboardingSelectedSDK;
}

export function ConsoleModal({
  Body,
  Header,
  Footer,
  selectedPlatform,
  closeModal,
  organization,
}: ConsoleModalProps & ModalRenderProps) {
  const platformKey = selectedPlatform.key;
  const config = CONSOLE_PLATFORM_INSTRUCTIONS[platformKey as ConsolePlatform];

  useEffect(() => {
    trackAnalytics('gaming.partner_request_access_guidance_modal_opened', {
      platform: selectedPlatform.key,
      organization,
    });
  }, [selectedPlatform.key, organization]);

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
