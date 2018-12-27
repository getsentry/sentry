import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {withKnobs, boolean} from '@storybook/addon-knobs';

import Well from 'app/components/well';

const stories = storiesOf('UI|Well', module);
stories.addDecorator(withKnobs);

stories.add(
  'default',
  withInfo('Well is a container that adds background and padding')(() => {
    const hasImage = boolean('hasImage', false);
    const centered = boolean('centered', false);

    return (
      <Well hasImage={hasImage} centered={centered}>
        <p>Some content in the well</p>
      </Well>
    );
  })
);
