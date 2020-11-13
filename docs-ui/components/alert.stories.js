import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';

import space from 'app/styles/space';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {IconInfo, IconCheckmark, IconWarning, IconNot} from 'app/icons';

export default {
  title: 'Core/Alerts/Alert',
};

export const Default = withInfo('Inline alert messages')(() => (
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
));

export const WithIcons = withInfo('Inline alert messages')(() => (
  <Grid>
    <Alert type="info" icon={<IconInfo size="md" />}>
      <ExternalLink href="#">Info message with a url</ExternalLink>
    </Alert>

    <Alert type="success" icon={<IconCheckmark size="md" />}>
      Success message without a url
    </Alert>

    <Alert type="warning" icon={<IconWarning size="md" />}>
      Warning message
    </Alert>

    <Alert type="error" icon={<IconNot size="md" />}>
      Background workers haven't checked in recently. This can mean an issue with your
      configuration or a serious backlog in tasks.
    </Alert>
  </Grid>
));

WithIcons.story = {
  name: 'With icons',
};

export const System = withInfo(
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
));

const Grid = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
