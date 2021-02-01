import React from 'react';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import MenuItem from 'app/components/menuItem';

export default {
  title: 'Core/Dropdowns/DropdownControl',
};

export const BasicLabelKnobs = ({
  menuWidth,
  alwaysRenderMenu,
  alignRight,
  blendWithActor,
}) => {
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
};

BasicLabelKnobs.storyName = 'basic label + knobs';
BasicLabelKnobs.args = {
  menuWidth: '',
  alwaysRenderMenu: true,
  alignRight: false,
  blendWithActor: false,
};
BasicLabelKnobs.parameters = {
  docs: {
    description: {
      story: 'Using a string value for the button label',
    },
  },
};

export const BasicMenuItem = () => (
  <div className="clearfix">
    <DropdownControl label={<em>Slanty</em>}>
      <MenuItem href="">Item</MenuItem>
      <MenuItem href="">Item</MenuItem>
    </DropdownControl>
  </div>
);

BasicMenuItem.storyName = 'basic menu item';
BasicMenuItem.parameters = {
  docs: {
    description: {
      story: 'Element labels replace the button contents',
    },
  },
};

export const ElementLabel = () => (
  <div className="clearfix">
    <DropdownControl label="Created Date">
      <MenuItem href="">Item</MenuItem>
      <MenuItem href="">Item</MenuItem>
    </DropdownControl>
  </div>
);

ElementLabel.storyName = 'element label';
ElementLabel.parameters = {
  docs: {
    description: {
      story: 'Element labels replace the button contents',
    },
  },
};

export const PrefixedLabel = () => (
  <div className="clearfix">
    <DropdownControl buttonProps={{prefix: 'Sort By'}} label="Created Date">
      <MenuItem href="">Item</MenuItem>
      <MenuItem href="">Item</MenuItem>
    </DropdownControl>
  </div>
);

PrefixedLabel.storyName = 'prefixed label';
PrefixedLabel.parameters = {
  docs: {
    description: {
      story: 'Element labels replace the button contents',
    },
  },
};

export const CustomButton = () => (
  <div className="clearfix">
    <DropdownControl
      button={({getActorProps}) => <button {...getActorProps()}>click me</button>}
    >
      <MenuItem href="">Item</MenuItem>
      <MenuItem href="">Item</MenuItem>
    </DropdownControl>
  </div>
);

CustomButton.storyName = 'custom button';
CustomButton.parameters = {
  docs: {
    description: {
      story: 'button prop lets you replace the entire button.',
    },
  },
};
