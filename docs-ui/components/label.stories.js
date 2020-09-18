import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Label from 'app/components/label';

export default {
  title: 'UI/Label',
};

export const Default = withInfo(
  'A label to use for example in Issues to indicate Unhandled error'
)(() => {
  return (
    <React.Fragment>
      <Label
        text="Unhandled"
        tooltip="An unhandled error was detected in this Issue."
        backgroundColor="red100"
        textColor="red300"
      />
      <Label text="Texttext" backgroundColor="orange100" textColor="orange300" />
    </React.Fragment>
  );
});

Default.story = {
  name: 'default',
};
