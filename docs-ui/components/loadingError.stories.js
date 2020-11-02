import React from 'react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import {Panel, PanelHeader} from 'app/components/panels';
import LoadingError from 'app/components/loadingError';

export default {
  title: 'UI/Loaders/LoadingError',
};

export const Default = withInfo('Loading error with default message')(() => (
  <LoadingError onRetry={action('retry')} />
));

Default.story = {
  name: 'default',
};

export const CustomMessage = withInfo('Loading error with custom message')(() => (
  <LoadingError message="Data failed to load" onRetry={action('retry')} />
));

CustomMessage.story = {
  name: 'custom message',
};

export const InPanel = withInfo('Loading error inside panel component')(() => (
  <Panel>
    <PanelHeader>Header</PanelHeader>
    <LoadingError onRetry={action('retry')} />
  </Panel>
));

InPanel.story = {
  name: 'in panel',
};
