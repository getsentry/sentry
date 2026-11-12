import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {AUTOFIX_USER_CONTEXT_MAX_LENGTH} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';

interface RestartAutofixModalProps extends ModalRenderProps {
  onRestart: (userContext: string) => void;
}

export function RestartAutofixModal({
  Header,
  Body,
  Footer,
  closeModal,
  onRestart,
}: RestartAutofixModalProps) {
  const [userContext, setUserContext] = useState('');

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Start a new analysis')}</Heading>
      </Header>
      <Body>
        <Grid gap="md">
          <Text as="p">{t('What should Seer do differently this time?')}</Text>
          <TextArea
            autosize
            rows={3}
            autoFocus
            maxLength={AUTOFIX_USER_CONTEXT_MAX_LENGTH}
            placeholder={t('e.g. The bug is in the cache layer, not the API handler.')}
            value={userContext}
            onChange={event => setUserContext(event.target.value)}
          />
        </Grid>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!userContext.trim()}
            onClick={() => {
              onRestart(userContext.trim());
              closeModal();
            }}
          >
            {t('Start new analysis')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}
