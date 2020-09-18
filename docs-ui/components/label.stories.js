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
        type="error"
      />{' '}
      <Label text="Texttext" type="success" /> <Label text="Texttext" type="warning" />{' '}
      <Label text="Texttext" type="info" />
    </React.Fragment>
  );
});

Default.story = {
  name: 'default',
};
