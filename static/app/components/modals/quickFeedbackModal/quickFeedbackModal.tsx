import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextArea from 'sentry/components/forms/controls/textarea';
import {t} from 'sentry/locale';

interface Props extends ModalRenderProps {
  onSubmit: (message: string) => void;
  prompt: string | ReactNode;
  // title?: string | ReactNode;
}

export default function QuickFeedbackModal({
  Header,
  Body,
  Footer,
  onSubmit,
  prompt,
  closeModal,
}: Props) {
  const [message, setMessage] = useState('');
  return (
    <Fragment>
      <Header closeButton>{prompt}</Header>
      <form
        onSubmit={event => {
          event.preventDefault();

          onSubmit(message);
          closeModal();
        }}
      >
        <Body>
          <TextArea autosize rows={4} onChange={e => setMessage(e.target.value)} />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              size="sm"
              onClick={closeModal}
              // disabled={disableInputs}
            >
              {t('Cancel')}
            </Button>
            <Button size="sm" priority="primary" type="submit">
              {t('Send Feedback')}
            </Button>
          </ButtonBar>
        </Footer>
      </form>
    </Fragment>
  );
}

export const modalCss = css``;
