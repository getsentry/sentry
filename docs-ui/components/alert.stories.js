import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import space from 'app/styles/space';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';

storiesOf('UI|Alerts/Alert', module)
  .add(
    'Default',
    withInfo('Inline alert messages')(() => (
      <Grid>
        <Alert type="info">
          <ExternalLink href="#">Info message with a url</ExternalLink>
        </Alert>

        <Alert type="success">Success message without a url</Alert>

        <Alert type="warning">Warning message</Alert>

        <Alert type="error">
          Background workers haven't checked in recently. This can mean an issue with your
          configuration or a serious backlog in tasks.
        </Alert>
      </Grid>
    ))
  )
  .add(
    'System',
    withInfo(
      'System-level alert messages that appear at the top of the viewport, or embedded in a panel'
    )(() => (
      <Grid>
        <Alert type="info" system>
          <ExternalLink href="#">Info message with a url</ExternalLink>
        </Alert>

        <Alert type="success" system>
          Success message without a url
        </Alert>

        <Alert type="warning" system>
          Warning message
        </Alert>

        <Alert type="error" system>
          Background workers haven't checked in recently. This can mean an issue with your
          configuration or a serious backlog in tasks.
        </Alert>
      </Grid>
    ))
  );

const Grid = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
