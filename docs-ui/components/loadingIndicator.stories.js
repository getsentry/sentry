import {withInfo} from '@storybook/addon-info';

import LoadingIndicator from 'app/components/loadingIndicator';

export default {
  title: 'UI/Loaders/LoadingIndicator',
};

export const All = withInfo('Loading indicators. Triangle has negative margins.')(() => (
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
));

All.story = {
  name: 'all',
};

export const Default = withInfo('Default loading indicator')(() => (
  <LoadingIndicator>Loading message</LoadingIndicator>
));

Default.story = {
  name: 'default',
};

export const Mini = withInfo('Small loading indicator')(() => (
  <LoadingIndicator mini>Loading message</LoadingIndicator>
));

Mini.story = {
  name: 'mini',
};

export const Triangle = withInfo(
  'Triangle loading indicator. Be aware it has negative margins.'
)(() => (
  <div style={{paddingBottom: 300}}>
    <LoadingIndicator triangle>Loading message</LoadingIndicator>
  </div>
));

Triangle.story = {
  name: 'triangle',
};

export const Finished = withInfo('Add finished loading')(() => (
  <div style={{paddingBottom: 300}}>
    <LoadingIndicator finished>Finished message</LoadingIndicator>
  </div>
));

Finished.story = {
  name: 'finished',
};
