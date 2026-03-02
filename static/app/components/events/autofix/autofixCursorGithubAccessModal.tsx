import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';

const CURSOR_GITHUB_APP_URL = 'https://github.com/apps/cursor';

export function AutofixCursorGithubAccessModal({
  Header,
  Body,
  Footer,
  closeModal,
}: ModalRenderProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Grant Cursor GitHub Access')}</Heading>
      </Header>
      <Body>
        <Text as="p">
          {tct(
            'Cursor does not have access to this repository. To use Cursor as a coding agent, you need to install the [link:Cursor GitHub App] and grant it access to your repository.',
            {
              link: <ExternalLink href={CURSOR_GITHUB_APP_URL} />,
            }
          )}
        </Text>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Remind me later')}</Button>
          <LinkButton href={CURSOR_GITHUB_APP_URL} external priority="primary">
            {t('Install Cursor GitHub App')}
          </LinkButton>
        </Grid>
      </Footer>
    </Fragment>
  );
}
