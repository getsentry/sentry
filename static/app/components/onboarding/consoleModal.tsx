import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

export function ConsoleModal({Body, Header, CloseButton, closeModal}: ModalRenderProps) {
  return (
    <Fragment>
      <Header>
        <CloseButton onClick={closeModal} />
      </Header>
      <Body>
        <p>Console Modal</p>
      </Body>
    </Fragment>
  );
}
