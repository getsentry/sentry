import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';

const GITHUB_COPILOT_URL = 'https://github.com/features/copilot';

export function AutofixGithubCopilotPurchaseModal({
  Header,
  Body,
  Footer,
  closeModal,
}: ModalRenderProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('GitHub Copilot License Required')}</Heading>
      </Header>
      <Body>
        <Text as="p">
          {tct(
            'Your GitHub account does not have an active GitHub Copilot license. To use Copilot as a coding agent, you will need an active [link:Copilot subscription].',
            {
              link: <ExternalLink href={GITHUB_COPILOT_URL} />,
            }
          )}
        </Text>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Remind me later')}</Button>
          <LinkButton href={GITHUB_COPILOT_URL} external priority="primary">
            {t('Get GitHub Copilot')}
          </LinkButton>
        </Grid>
      </Footer>
    </Fragment>
  );
}
