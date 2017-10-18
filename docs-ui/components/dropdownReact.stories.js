import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import DropdownReact from 'sentry-ui/dropdownReact';
import MenuItem from 'sentry-ui/menuItem';

storiesOf('Links/DropdownReact', module)
  .add(
    'anchor left (default)',
    withInfo('Anchors to left side')(() => (
      <div className="clearfix">
        <DropdownReact title="Test">
          <MenuItem href="">Item</MenuItem>
        </DropdownReact>
      </div>
    ))
  )
  .add(
    'anchor right',
    withInfo('Anchors to right side')(() => (
      <div className="clearfix">
        <DropdownReact anchorRight title="Test">
          <MenuItem href="">Item</MenuItem>
        </DropdownReact>
      </div>
    ))
  );
