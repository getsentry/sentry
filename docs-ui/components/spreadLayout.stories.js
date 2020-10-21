import {withInfo} from '@storybook/addon-info';

import SpreadLayout from 'app/components/spreadLayout';

export default {
  title: 'Deprecated/ComponentLayouts/SpreadLayout',
};

export const Default = withInfo(
  'Children elements get spread out (flexbox space-between)'
)(() => (
  <SpreadLayout style={{backgroundColor: '#fff'}}>
    <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Spread</div>
    <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
  </SpreadLayout>
));

Default.story = {
  name: 'default',
};

export const NoCenter = withInfo(
  'Children elements get spread out (flexbox space-between)'
)(() => (
  <SpreadLayout center={false} style={{backgroundColor: '#fff'}}>
    <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Spread</div>
    <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
  </SpreadLayout>
));

NoCenter.story = {
  name: 'no center',
};
