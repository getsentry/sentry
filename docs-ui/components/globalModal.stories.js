import React from 'react';
import {withInfo} from '@storybook/addon-info';

import GlobalModal from 'app/components/globalModal';
import Button from 'app/components/button';
import {openModal} from 'app/actionCreators/modal';

export default {
  title: 'UI/Modals',
};

export const _GlobalModal = withInfo('Call `openModal` action creator to open a modal', {
  propTablesExclude: ['Button'],
})(() => (
  <div>
    <Button
      onClick={() =>
        openModal(({closeModal, Header, Body}) => (
          <div>
            <Header>Modal Header</Header>
            <Body>
              <div>Test Modal Body</div>
              <Button onClick={closeModal}>Close</Button>
            </Body>
          </div>
        ))
      }
    >
      Open
    </Button>
    <GlobalModal />
  </div>
));

_GlobalModal.story = {
  name: 'GlobalModal',
};
