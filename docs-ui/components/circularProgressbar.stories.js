import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {number} from '@storybook/addon-knobs';

import CircularProgressbar from 'app/components/circularProgressbar';

storiesOf('UI|CircularProgressbar', module).add(
  'default',
  withInfo('Description')(() => {
    const value = number('Value', 29);
    const size = number('Size', 20);
    const minValue = number('Min Value', 0);
    const maxValue = number('Max Value', 100);
    const strokeWidth = number('Stroke Width', 3);

    return (
      <React.Fragment>
        <CircularProgressbar
          value={value}
          size={size}
          minValue={minValue}
          maxValue={maxValue}
          strokeWidth={strokeWidth}
        />
        <CircularProgressbar value={61} />
        <CircularProgressbar value={85} />
      </React.Fragment>
    );
  })
);
