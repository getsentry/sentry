import React from 'react';

import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';

export default {
  title: 'Core/Dropdowns/DropdownLink',
  component: DropdownLink,
};

export const AnchorLeftDefault = () => (
  <div className="clearfix">
    <DropdownLink title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
);

AnchorLeftDefault.storyName = 'anchor left (default)';

export const AnchorRight = () => (
  <div className="clearfix">
    <DropdownLink anchorRight title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
);

AnchorRight.storyName = 'anchor right';

export const NestedDropdown = () => (
  <div className="clearfix">
    <DropdownLink title="Nested Menu">
      <li className="dropdown-submenu">
        <DropdownLink title="submenu" caret={false} isNestedDropdown alwaysRenderMenu>
          <MenuItem href="">Sub Item 1</MenuItem>
          <MenuItem href="">Sub Item 2</MenuItem>
        </DropdownLink>
      </li>
      <MenuItem href="">Item 2</MenuItem>
    </DropdownLink>
  </div>
);

NestedDropdown.storyName = 'nested dropdowns';
