import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import space from 'app/styles/space';
import AlertMessage from 'app/components/alertMessage';

storiesOf('UI|Alerts/AlertMessage', module)
  .add(
    'Default',
    withInfo('Inline alert messages')(() => (
      <Grid>
        <AlertMessage
          alert={{
            id: 'id',
            message: 'Info message with a url',
            type: 'info',
            url: '#',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Success message without a url',
            type: 'success',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Warning Message',
            type: 'warning',
            url: '#',
          }}
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Error Message',
            type: 'error',
            url: '#',
          }}
        />
      </Grid>
    ))
  )
  .add(
    'System',
    withInfo('System-level alert messages that appear at the top of the viewport')(() => (
      <Grid>
        <AlertMessage
          alert={{
            id: 'id',
            message: 'Info message with a url',
            type: 'info',
            url: '#',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Success message without a url',
            type: 'success',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message: 'Warning Message',
            type: 'warning',
            url: 'url',
          }}
          system
        />

        <AlertMessage
          alert={{
            id: 'id',
            message:
              "Background workers haven't checked in recently. This can mean an issue with your configuration or a serious backlog in tasks.",
            type: 'error',
            url: '#',
          }}
          system
        />
      </Grid>
    ))
  );

const Grid = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
