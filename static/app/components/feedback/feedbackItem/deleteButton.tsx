import {Fragment} from 'react';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  onDelete: () => void | Promise<void>;
}

export default function openDeleteModal({onDelete}: Props) {
  openModal(({Body, Footer, closeModal}: ModalRenderProps) => (
    <Fragment>
      <Body>
        {t('Deleting this feedback is permanent. Are you sure you wish to continue?')}
      </Body>
      <Footer>
        <Flex gap={space(1)}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="danger"
            onClick={() => {
              closeModal();
              onDelete();
            }}
          >
            {t('Delete')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}
