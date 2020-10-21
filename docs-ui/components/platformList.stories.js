import {withInfo} from '@storybook/addon-info';

import PlatformList from 'app/components/platformList';

export default {
  title: 'UI/Platform List',
};

export const _PlatformList = withInfo('Stacked list of platform and framework icons')(
  () => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
      <PlatformList platforms={['java', 'php', 'javascript', 'cocoa', 'ruby']} />
    </div>
  )
);
