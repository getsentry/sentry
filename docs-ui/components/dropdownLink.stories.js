import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import DropdownLink from 'sentry-ui/dropdownLink';
import MenuItem from 'sentry-ui/menuItem';

storiesOf('DropdownLink', module)
  .add(
    'anchor right',
    withInfo('Anchors to right side')(() => (
      <div className="clearfix">
        <DropdownLink anchor="right" title="Test">
          <MenuItem href="">Item</MenuItem>
        </DropdownLink>
      </div>
    ))
  )
  .add(
    'anchor left',
    withInfo('Anchors to left side')(() => (
      <div className="clearfix">
        <DropdownLink anchor="left" title="Test">
          <MenuItem href="">Item</MenuItem>
        </DropdownLink>
      </div>
    ))
  );
