import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Alerts/Alert',
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
    <Alert type="info" showIcon>
      <ExternalLink href="#">Info message with a url</ExternalLink>
    </Alert>

    <Alert type="success" showIcon>
      Success message without a url
    </Alert>

    <Alert type="warning" showIcon>
      Warning message
    </Alert>

    <Alert type="error" showIcon>
      Background workers haven't checked in recently. This can mean an issue with your
      configuration or a serious backlog in tasks.
    </Alert>
  </Grid>
);

WithIcons.storyName = 'With Leading Icons';
WithIcons.parameters = {
  docs: {
    description: {
      story: 'Optional leading icon via the `showIcon` prop',
    },
  },
};

export const WithTrailingItems = () => (
  <Grid>
    <Alert type="info" trailingItems={<Button size="xs">Trailing Button</Button>}>
      <ExternalLink href="#">Info message with a url</ExternalLink>
    </Alert>

    <Alert type="success" trailingItems={<Button size="xs">Trailing Button</Button>}>
      Success message without a url
    </Alert>

    <Alert type="warning" trailingItems={<Button size="xs">Trailing Button</Button>}>
      Warning message
    </Alert>

    <Alert type="error" trailingItems={<Button size="xs">Trailing Button</Button>}>
      Background workers haven't checked in recently. This can mean an issue with your
      configuration or a serious backlog in tasks.
    </Alert>
  </Grid>
);

WithTrailingItems.storyName = 'With Trailing Items';
WithTrailingItems.parameters = {
  docs: {
    description: {
      story: 'Optional trailing items via the `trailingItems` prop',
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

export const Expandable = () => {
  return (
    <Grid>
      <Alert type="info" showIcon expand={[<div key="1">Here is some details</div>]}>
        Expandable Alert
      </Alert>
    </Grid>
  );
};

Expandable.storyName = 'Expandable';
Expandable.parameters = {
  docs: {
    description: {
      story: 'Expand with details',
    },
  },
};

const Grid = styled('div')`
  display: grid;
  gap: ${space(1)};
`;
