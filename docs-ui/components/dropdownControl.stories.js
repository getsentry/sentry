import {withInfo} from '@storybook/addon-info';
import {text, boolean} from '@storybook/addon-knobs';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import MenuItem from 'app/components/menuItem';

export default {
  title: 'Core/Dropdowns/DropdownControl',
};

export const BasicLabelKnobs = withInfo('Using a string value for the button label')(
  () => {
    const menuWidth = text('menuWidth', undefined);
    const alwaysRenderMenu = boolean('alwaysRenderMenu', true);
    const alignRight = boolean('alignRight', false);
    const blendWithActor = boolean('blendWithActor', false);

    return (
      <div className="clearfix">
        <DropdownControl
          label="Open Me"
          menuWidth={menuWidth}
          alwaysRenderMenu={alwaysRenderMenu}
          alignRight={alignRight}
          blendWithActor={blendWithActor}
        >
          <DropdownItem href="">Href Item</DropdownItem>
          <DropdownItem to="">Router Item</DropdownItem>
          <DropdownItem disabled>Disabled Item</DropdownItem>
          <DropdownItem divider />
          <DropdownItem isActive href="">
            Active Item
          </DropdownItem>
        </DropdownControl>
      </div>
    );
  }
);

BasicLabelKnobs.story = {
  name: 'basic label + knobs',
};

export const BasicMenuItem = withInfo('Element labels replace the button contents')(
  () => (
    <div className="clearfix">
      <DropdownControl label={<em>Slanty</em>}>
        <MenuItem href="">Item</MenuItem>
        <MenuItem href="">Item</MenuItem>
      </DropdownControl>
    </div>
  )
);

BasicMenuItem.story = {
  name: 'basic menu item',
};

export const ElementLabel = withInfo('Element labels replace the button contents')(() => (
  <div className="clearfix">
    <DropdownControl label={<em>Created Date</em>}>
      <MenuItem href="">Item</MenuItem>
      <MenuItem href="">Item</MenuItem>
    </DropdownControl>
  </div>
));

ElementLabel.story = {
  name: 'element label',
};

export const PrefixedLabel = withInfo('Element labels replace the button contents')(
  () => (
    <div className="clearfix">
      <DropdownControl buttonProps={{prefix: 'Sort By'}} label={<em>Created At</em>}>
        <MenuItem href="">Item</MenuItem>
        <MenuItem href="">Item</MenuItem>
      </DropdownControl>
    </div>
  )
);

PrefixedLabel.story = {
  name: 'prefixed label',
};

export const CustomButton = withInfo('button prop lets you replace the entire button.')(
  () => (
    <div className="clearfix">
      <DropdownControl
        button={({getActorProps}) => <button {...getActorProps()}>click me</button>}
      >
        <MenuItem href="">Item</MenuItem>
        <MenuItem href="">Item</MenuItem>
      </DropdownControl>
    </div>
  )
);

CustomButton.story = {
  name: 'custom button',
};
