import DropdownLink from 'sentry/components/dropdownLink';
import MenuItem from 'sentry/components/menuItem';

export default {
  title: 'Components/Buttons/Dropdowns/Dropdown Link',
  component: DropdownLink,
};

export const AnchorLeftDefault = () => (
  <div className="clearfix">
    <DropdownLink title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
);

AnchorLeftDefault.storyName = 'Anchor Left (default)';

export const AnchorRight = () => (
  <div className="clearfix">
    <DropdownLink anchorRight title="Test">
      <MenuItem href="">Item</MenuItem>
    </DropdownLink>
  </div>
);

AnchorRight.storyName = 'Anchor Right';

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

NestedDropdown.storyName = 'Nested Dropdowns';
