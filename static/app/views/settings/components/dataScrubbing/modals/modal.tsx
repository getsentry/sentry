import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';

type Props = {
  content: React.ReactElement;
  disabled: boolean;
  onSave: () => void;
  title: string;
} & ModalRenderProps;

const Modal = ({
  title,
  onSave,
  content,
  disabled,
  Header,
  Body,
  Footer,
  closeModal,
}: Props) => (
  <Fragment>
    <Header closeButton>
      <h5>{title}</h5>
    </Header>
    <Body>{content}</Body>
    <Footer>
      <ButtonBar gap={1.5}>
        <Button onClick={closeModal}>{t('Cancel')}</Button>
        <Button onClick={onSave} disabled={disabled} priority="primary">
          {t('Save Rule')}
        </Button>
      </ButtonBar>
    </Footer>
  </Fragment>
);

export default Modal;
