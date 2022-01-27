import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import MenuItem from 'sentry/components/menuItem';

export default {
  title: 'Components/Buttons/Dropdowns/Dropdown Control',
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

BasicLabelKnobs.storyName = 'Basic Label + Knobs';
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

BasicMenuItem.storyName = 'Basic Menu Item';
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

ElementLabel.storyName = 'Element Label';
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

PrefixedLabel.storyName = 'Prefixed Label';
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

CustomButton.storyName = 'Custom Button';
CustomButton.parameters = {
  docs: {
    description: {
      story: 'button prop lets you replace the entire button.',
    },
  },
};
