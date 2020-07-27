import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {boolean} from '@storybook/addon-knobs';

import Well from 'app/components/well';

export default {
  title: 'UI/Well',
};

export const _Well = withInfo('Well is a container that adds background and padding')(
  () => {
    const hasImage = boolean('hasImage', false);
    const centered = boolean('centered', false);

    return (
      <Well hasImage={hasImage} centered={centered}>
        <p>Some content in the well</p>
      </Well>
    );
  }
);

_Well.story = {
  name: 'default',
};
