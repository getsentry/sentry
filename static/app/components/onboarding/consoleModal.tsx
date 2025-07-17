import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

const consoleConfig = {
  playstation: {
    content: (
      <Fragment>
        <p>
          {t(
            'You can get started using Sentry on PlayStation without any changes to your game, on devkits as well as retail devices.'
          )}
        </p>
        <p>
          {t(
            'Configuration can be done in your Sentry project settings, on a new page called PlayStation that is made available to you once the middleware verification process is done.'
          )}
        </p>
        <p>
          {tct(
            "The verification process starts inside the [partnersWebsiteLink:PlayStation Partners website] where you can confirm your developer status by clicking on [italic:Confirm status]. We'll receive your request and get back to you with the next steps.",
            {
              partnersWebsiteLink: (
                <ExternalLink href="https://game.develop.playstation.net/tm/verify/functionalsw" />
              ),
              italic: <i />,
            }
          )}
        </p>
        <p>
          {tct(
            "Even though crash dump collection doesn't require a Sentry SDK, if you add it, you can get additional context in your crash dumps, as well as capture non-fatal events. Sentry offers SDK support specifically for PlayStation so you can add context such as [breadcrumbsLink:breadcrumbs] and [tagsLink:tags].",
            {
              breadcrumbsLink: (
                <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/breadcrumbs/" />
              ),
              tagsLink: (
                <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#tags" />
              ),
            }
          )}
        </p>
        <Alert type="info">
          {t(
            'PlayStation support is exclusive to our SaaS offering, as it depends on confidential components that cannot be distributed for self-hosted use.'
          )}
        </Alert>
      </Fragment>
    ),
    note: (
      <p>
        {t(
          '"PlayStation", "PS5" are registered trademarks or trademarks of Sony Interactive Entertainment Inc.'
        )}
      </p>
    ),
  },
  'nintendo-switch': {
    content: (
      <Fragment>
        <p>
          {t(
            'You can get started using Sentry on Nintendo Switch without any changes to your game, on devkits as well as retail devices.'
          )}
        </p>
        <p>
          {tct(
            "It can be done directly on Nintendo's CRPORTAL. The two environments available are lp1 for retail devices and dd1 for devkits. In both cases you can configure Nintendo's servers to start forwarding your crashes directly to Sentry.",
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
        <p>
          {tct(
            'If you want to add additional context to your crash dumps, or you want to capture non-fatal events, Sentry offers an SDK specifically for Nintendo Switch. It allows for adding additional context such as [breadcrumbsLink:breadcrumbs] and [tagsLink:tags]. To get access to the SDK, please reach out via the [nintendoDeveloperAuthorizationFormLink:Nintendo Developer Authorization form].',
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
        <p>{t('Support for Switch 2 as well as the original Switch is available.')}</p>
      </Fragment>
    ),
    note: (
      <p>
        {t(
          '"Nintendo", "Nintendo Switch" are trademarks or registered trademarks of Nintendo.'
        )}
      </p>
    ),
  },
  xbox: {
    content: (
      <Fragment>
        <p>
          {tct(
            "You can get started using Sentry by [microsoftGameDevelopmentKitLink: requesting Microsoft Game Development Kit (GDK) Middleware access]. We'll receive your request and get back to you with the next steps.",
            {
              microsoftGameDevelopmentKitLink: (
                <ExternalLink href="https://developer.microsoft.com/en-us/games/support/request-gdkx-middleware" />
              ),
            }
          )}
        </p>
        <p>
          {t(
            'Support is available on Xbox Series X and S, by adding the Sentry SDK to your game. Crash collection as well as non-fatal events can be captured, on devkits as well as retail devices.'
          )}
        </p>
        <p>
          {tct(
            'You can also use Sentry’s [unityLink:Unity] and [unrealLink:Unreal Engine] SDKs with Xbox.',
            {
              unityLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/game-consoles/" />
              ),
              unrealLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/game-consoles/" />
              ),
            }
          )}
        </p>
      </Fragment>
    ),
    note: (
      <p>
        {t('"Microsoft", "Xbox" are trademarks of the Microsoft group of companies.')}
      </p>
    ),
  },
};

interface ConsoleModalProps extends ModalRenderProps {
  selectedPlatform: OnboardingSelectedSDK;
}

export function ConsoleModal({
  Body,
  Header,
  Footer,
  selectedPlatform,
  closeModal,
}: ConsoleModalProps) {
  const platformKey = selectedPlatform.key as keyof typeof consoleConfig;
  const {content, note} = consoleConfig[platformKey];

  return (
    <Fragment>
      <Header closeButton>
        <HeaderContent>
          <PlatformIcon size={32} format="lg" platform={selectedPlatform.key} />
          <h4>{t('Request Access for %s', selectedPlatform.name)}</h4>
        </HeaderContent>
      </Header>
      <Body>
        {content}
        <Divider />
        {note}
      </Body>
      <Footer>
        <Button priority="primary" onClick={closeModal}>
          {t('Got it')}
        </Button>
      </Footer>
    </Fragment>
  );
}

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
`;

export const modalCss = css`
  max-width: 500px;
  width: 100%;
`;

const HeaderContent = styled(Flex)`
  align-items: center;
  gap: ${p => p.theme.space.xl};
`;
