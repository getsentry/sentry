import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {IconCheckmark, IconInfo, IconNot, IconWarning} from 'app/icons';
import space from 'app/styles/space';

export default {
  title: 'Core/Alerts/Alert',
  component: Alert,
  parameters: {
    controls: {hideNoControlsWarning: true},
  },
};

export const Default = () => (
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
);
Default.parameters = {
  docs: {
    description: {
      story: 'Inline alert messages',
    },
  },
};

export const WithIcons = () => (
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
);

WithIcons.storyName = 'With icons';
WithIcons.parameters = {
  docs: {
    description: {
      story: 'Inline alert messages',
    },
  },
};

export const System = () => (
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
);

System.parameters = {
  docs: {
    description: {
      story:
        'System-level alert messages that appear at the top of the viewport, or embedded in a panel',
    },
  },
};

const Grid = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
