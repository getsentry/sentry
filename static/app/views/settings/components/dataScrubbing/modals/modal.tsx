import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
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
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal} redesign>{t('Cancel')}</Button>
          <Button onClick={onSave} redesign disabled={disabled} priority="primary">
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default Modal;
