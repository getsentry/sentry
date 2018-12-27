import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';

['UI|Links/DropdownLink', 'UI|Dropdowns/DropdownLink'].forEach(name =>
  storiesOf(name, module)
    .add(
      'anchor left (default)',
      withInfo('Anchors to left side')(() => (
        <div className="clearfix">
          <DropdownLink title="Test">
            <MenuItem href="">Item</MenuItem>
          </DropdownLink>
        </div>
      ))
    )
    .add(
      'anchor right',
      withInfo('Anchors to right side')(() => (
        <div className="clearfix">
          <DropdownLink anchorRight title="Test">
            <MenuItem href="">Item</MenuItem>
          </DropdownLink>
        </div>
      ))
    )
);
