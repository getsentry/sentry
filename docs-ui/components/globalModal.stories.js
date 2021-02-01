import React from 'react';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import GlobalModal from 'app/components/globalModal';

export default {
  title: 'Layouts/Modals',
};

export const _GlobalModal = () => (
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
);

_GlobalModal.storyName = 'GlobalModal';
_GlobalModal.parameters = {
  docs: {
    description: {
      story: 'Call `openModal` action creator to open a modal',
    },
  },
};
