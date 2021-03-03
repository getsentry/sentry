import React from 'react';

import LoadingIndicator from 'app/components/loadingIndicator';

export default {
  title: 'UI/Loaders/LoadingIndicator',
  component: LoadingIndicator,
};

export const All = () => (
  <div>
    <div>
      Default
      <LoadingIndicator />
    </div>
    <div style={{marginBottom: 240}}>
      Mini
      <LoadingIndicator mini />
    </div>
    <div style={{position: 'relative'}}>
      Triangle
      <LoadingIndicator triangle />
    </div>
    <div style={{position: 'relative'}}>
      Finished
      <LoadingIndicator finished />
    </div>
  </div>
);

All.storyName = 'all';
All.parameters = {
  docs: {
    description: {
      story: 'Loading indicators. Triangle has negative margins.',
    },
  },
};

export const Default = () => <LoadingIndicator>Loading message</LoadingIndicator>;

Default.storyName = 'default';

export const Mini = () => <LoadingIndicator mini>Loading message</LoadingIndicator>;

Mini.storyName = 'mini';
Mini.parameters = {
  docs: {
    description: {
      story: 'Small loading indicator',
    },
  },
};

export const Triangle = () => (
  <div style={{paddingBottom: 300}}>
    <LoadingIndicator triangle>Loading message</LoadingIndicator>
  </div>
);

Triangle.storyName = 'triangle';
Triangle.parameters = {
  docs: {
    description: {
      story: 'Triangle loading indicator. Be aware it has negative margins.',
    },
  },
};

export const Finished = () => (
  <div style={{paddingBottom: 300}}>
    <LoadingIndicator finished>Finished message</LoadingIndicator>
  </div>
);

Finished.storyName = 'finished';
Finished.parameters = {
  docs: {
    description: {
      story: 'Add finished loading',
    },
  },
};
