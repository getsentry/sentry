import React from 'react';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';

// TODO(scttcper): modal not working
export default {
  title: 'Core/Buttons/Confirm',
  component: Confirm,
  args: {
    message: 'Are you sure you want to do this?',
  },
  argTypes: {
    onConfirm: {action: 'confirmed'},
  },
};

export const _Confirm = ({...args}) => (
  <div>
    <Confirm {...args}>
      <Button priority="primary">Confirm on Button click</Button>
    </Confirm>
  </div>
);
_Confirm.parameters = {
  docs: {
    description: {
      story:
        'Component whose child is rendered as the "action" component that when clicked opens the "Confirm Modal"',
    },
  },
};
