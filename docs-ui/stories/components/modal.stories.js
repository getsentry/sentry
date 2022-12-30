import {useState} from 'react';

import Button from 'sentry/components/button';
import Modal from 'sentry/components/modal';

export default {
  title: 'Components/Modal',
  component: Modal,
};

export const Basic = args => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open</Button>
      <Modal closeButton onClose={() => setIsOpen(false)} visible={isOpen} {...args}>
        <Modal.Header>Modal Header</Modal.Header>
        <Modal.Body>
          <div>Test Modal Body</div>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </Modal.Body>
      </Modal>
    </div>
  );
};

Basic.args = {
  closeButton: true,
};
Basic.argTypes = {
  closeButton: {
    control: {
      type: 'boolean',
    },
  },
};
