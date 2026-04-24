import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';

const COPILOT_PLANS_URL = 'https://github.com/features/copilot/plans';
const COPILOT_QUOTA_DOCS_URL =
  'https://docs.github.com/en/copilot/concepts/billing/copilot-requests';

export function AutofixGithubCopilotQuotaModal({
  Header,
  Body,
  Footer,
  closeModal,
}: ModalRenderProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('GitHub Copilot Premium Quota Exhausted')}</Heading>
      </Header>
      <Body>
        <Text as="p">
          {tct(
            'Your GitHub Copilot plan does not have enough premium request quota remaining to launch a coding agent. To continue, [plansLink:upgrade your Copilot plan] or wait until your next billing cycle. You can [docsLink:learn more about Copilot premium requests].',
            {
              plansLink: <ExternalLink href={COPILOT_PLANS_URL} />,
              docsLink: <ExternalLink href={COPILOT_QUOTA_DOCS_URL} />,
            }
          )}
        </Text>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Remind me later')}</Button>
          <LinkButton href={COPILOT_PLANS_URL} external priority="primary">
            {t('Manage Copilot Plan')}
          </LinkButton>
        </Grid>
      </Footer>
    </Fragment>
  );
}
