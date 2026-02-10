import {Fragment} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';

type Props = {
  content: React.ReactElement;
  disabled: boolean;
  onSave: () => void;
  title: string;
} & ModalRenderProps;

function Modal({
  title,
  onSave,
  content,
  disabled,
  Header,
  Body,
  Footer,
  closeModal,
}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h5>{title}</h5>
      </Header>
      <Body>{content}</Body>
      <Footer>
        <ButtonBar gap="lg">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button onClick={onSave} disabled={disabled} priority="primary">
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default Modal;
