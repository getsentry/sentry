import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import DropdownLink from 'sentry-ui/dropdownLink';
import MenuItem from 'sentry-ui/menuItem';

storiesOf('DropdownLink')
  .addWithInfo('anchor right', '', () => (
    <div className="clearfix">
      <DropdownLink anchor="right" title="Test">
        <MenuItem href="">Item</MenuItem>
      </DropdownLink>
    </div>
  ))
  .addWithInfo('anchor left', '', () => (
    <div className="clearfix">
      <DropdownLink anchor="left" title="Test">
        <MenuItem href="">Item</MenuItem>
      </DropdownLink>
    </div>
  ));
