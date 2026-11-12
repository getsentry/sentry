import {Fragment} from 'react';

import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {AutofixResetPrompt} from './autofixResetPrompt';

interface RestartAutofixModalProps extends ModalRenderProps {
  onRestart: (userContext: string) => void;
}

export function RestartAutofixModal({
  Header,
  Body,
  closeModal,
  onRestart,
}: RestartAutofixModalProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Start a new analysis')}</Heading>
      </Header>
      <Body>
        <AutofixResetPrompt
          prompt={t('What should Seer do differently this time?')}
          placeholder={t('e.g. The bug is in the cache layer, not the API handler.')}
          submitLabel={t('Start new analysis')}
          onClosePrompt={closeModal}
          onReset={userContext => {
            onRestart(userContext);
            closeModal();
          }}
        />
      </Body>
    </Fragment>
  );
}
