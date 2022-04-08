import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import GlobalModal from 'sentry/components/globalModal';

export default {
  title: 'Views/Modals/Global Modal',
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

_GlobalModal.storyName = 'Global Modal';
_GlobalModal.parameters = {
  docs: {
    description: {
      story: 'Call `openModal` action creator to open a modal',
    },
  },
};
