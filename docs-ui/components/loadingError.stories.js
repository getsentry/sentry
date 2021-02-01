import React from 'react';
import {action} from '@storybook/addon-actions';

import LoadingError from 'app/components/loadingError';
import {Panel, PanelHeader} from 'app/components/panels';

export default {
  title: 'UI/Loaders/LoadingError',
};

export const Default = () => <LoadingError onRetry={action('retry')} />;

Default.storyName = 'default';
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

CustomMessage.storyName = 'custom message';
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

InPanel.storyName = 'in panel';
InPanel.parameters = {
  docs: {
    description: {
      story: 'Loading error inside panel component',
    },
  },
};
