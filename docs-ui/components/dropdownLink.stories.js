import React from 'react';
import {withInfo} from '@storybook/addon-info';

import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';

export default {
  title: 'UI/Dropdowns/DropdownLink',
};

export const AnchorLeftDefault = withInfo('Anchors to left side')(() => (
  <div className="clearfix">
    <DropdownLink title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
));

AnchorLeftDefault.story = {
  name: 'anchor left (default)',
};

export const AnchorRight = withInfo('Anchors to right side')(() => (
  <div className="clearfix">
    <DropdownLink anchorRight title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
));

AnchorRight.story = {
  name: 'anchor right',
};
