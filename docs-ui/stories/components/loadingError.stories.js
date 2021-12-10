import {action} from '@storybook/addon-actions';

import LoadingError from 'sentry/components/loadingError';
import {Panel, PanelHeader} from 'sentry/components/panels';

export default {
  title: 'Components/Alerts/Loading Error',
};

export const Default = () => <LoadingError onRetry={action('retry')} />;

Default.storyName = 'Default';
Default.storyDescription = {
  docs: {
    description: {
      story: 'Loading error with default message',
    },
  },
};

export const CustomMessage = () => (
  <LoadingError message="Data failed to load" onRetry={action('retry')} />
);

CustomMessage.storyName = 'Custom Message';
CustomMessage.parameters = {
  docs: {
    description: {
      story: 'Loading error with custom message',
    },
  },
};

export const InPanel = () => (
  <Panel>
    <PanelHeader>Header</PanelHeader>
    <LoadingError onRetry={action('retry')} />
  </Panel>
);

InPanel.storyName = 'In Panel';
InPanel.parameters = {
  docs: {
    description: {
      story: 'Loading error inside panel component',
    },
  },
};
