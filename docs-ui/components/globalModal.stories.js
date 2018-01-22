import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import GlobalModal from 'sentry-ui/globalModal';
import Button from 'sentry-ui/buttons/button';
import {openModal} from 'application-root/actionCreators/modal';

storiesOf('GlobalModal', module).add(
  'default',
  withInfo(
    `
    This is the onClick handler to open the modal:

    ~~~js
    openModal(({closeModal, Header, Body}) => (
      <div>
        \<Header\>Modal Header\</Header\>
        \<Body\>
          <div>Test Modal Body</div>
          <Button onClick={closeModal}>Close</Button>
        </Body>
      </div>
    ))
    ~~~

  `,
    {propTablesExclude: ['Button']}
  )(() => (
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
          ))}
      >
        Open
      </Button>
      <GlobalModal />
    </div>
  ))
);
