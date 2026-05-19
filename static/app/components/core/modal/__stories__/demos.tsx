import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ModalBody, ModalFooter, useModal} from '@sentry/scraps/modal';

export function BasicDemo() {
  const {openModal} = useModal();
  return (
    <Button
      onClick={() =>
        openModal(({Header, Body, Footer, closeModal}) => (
          <Fragment>
            <Header closeButton>Example Modal</Header>
            <Body>This is the modal content.</Body>
            <Footer>
              <Button variant="primary" onClick={closeModal}>
                Done
              </Button>
            </Footer>
          </Fragment>
        ))
      }
    >
      Open Modal
    </Button>
  );
}

export function CloseEventsDemo() {
  const {openModal} = useModal();
  return (
    <Flex gap="sm">
      <Button
        onClick={() =>
          openModal(
            ({Header, Body}) => (
              <Fragment>
                <Header closeButton>Escape Only</Header>
                <Body>Clicking outside will not close this modal.</Body>
              </Fragment>
            ),
            {closeEvents: 'escape-key'}
          )
        }
      >
        Escape Only
      </Button>
      <Button
        onClick={() =>
          openModal(
            ({Header, Body, Footer, closeModal}) => (
              <Fragment>
                <Header>No Auto-Close</Header>
                <Body>This modal can only be closed via the button below.</Body>
                <Footer>
                  <Button variant="primary" onClick={closeModal}>
                    Close
                  </Button>
                </Footer>
              </Fragment>
            ),
            {closeEvents: 'none'}
          )
        }
      >
        Manual Close Only
      </Button>
    </Flex>
  );
}

export function HookDemo() {
  const {openModal, closeModal, isOpen} = useModal();
  return (
    <Flex gap="sm" align="center">
      <Button
        onClick={() =>
          openModal(({Header, Body}) => (
            <Fragment>
              <Header closeButton>Hook Demo</Header>
              <Body>Opened via useModal() hook.</Body>
            </Fragment>
          ))
        }
      >
        Open
      </Button>
      <Button onClick={closeModal} disabled={!isOpen}>
        Close from Outside
      </Button>
    </Flex>
  );
}

export function SubComponentsDemo() {
  return (
    <Flex direction="column" gap="md">
      <ModalBody>
        This is a standalone ModalBody — useful for previewing styles outside a modal.
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </ModalFooter>
    </Flex>
  );
}
