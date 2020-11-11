import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {boolean, select} from '@storybook/addon-knobs';

import TextOverflow from 'app/components/textOverflow';

export default {
  title: 'Core/Style/Text',
};

export const _TextOverflow = withInfo(
  'Simple component that adds "text-overflow: ellipsis" and "overflow: hidden", still depends on container styles'
)(() => (
  <div style={{width: 50}}>
    <TextOverflow
      isParagraph={boolean('isParagraph', false)}
      ellipsisDirection={select(
        'ellipsisDirection',
        {right: 'right', left: 'left'},
        'right'
      )}
    >
      AReallyLongTextString
    </TextOverflow>
  </div>
));

_TextOverflow.story = {
  name: 'TextOverflow',
};
