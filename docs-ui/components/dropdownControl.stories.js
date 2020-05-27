import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean} from '@storybook/addon-knobs';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import MenuItem from 'app/components/menuItem';

storiesOf('UI|Dropdowns/DropdownControl', module)
  .add(
    'basic label + knobs',
    withInfo('Using a string value for the button label')(() => {
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
    })
  )
  .add(
    'basic menu item',
    withInfo('Element labels replace the button contents')(() => (
      <div className="clearfix">
        <DropdownControl label={<em>Slanty</em>}>
          <MenuItem href="">Item</MenuItem>
          <MenuItem href="">Item</MenuItem>
        </DropdownControl>
      </div>
    ))
  )
  .add(
    'element label',
    withInfo('Element labels replace the button contents')(() => (
      <div className="clearfix">
        <DropdownControl label={<em>Created Date</em>}>
          <MenuItem href="">Item</MenuItem>
          <MenuItem href="">Item</MenuItem>
        </DropdownControl>
      </div>
    ))
  )
  .add(
    'prefixed label',
    withInfo('Element labels replace the button contents')(() => (
      <div className="clearfix">
        <DropdownControl buttonProps={{prefix: 'Sort By'}} label={<em>Created At</em>}>
          <MenuItem href="">Item</MenuItem>
          <MenuItem href="">Item</MenuItem>
        </DropdownControl>
      </div>
    ))
  )
  .add(
    'custom button',
    withInfo('button prop lets you replace the entire button.')(() => (
      <div className="clearfix">
        <DropdownControl
          button={({getActorProps}) => <button {...getActorProps()}>click me</button>}
        >
          <MenuItem href="">Item</MenuItem>
          <MenuItem href="">Item</MenuItem>
        </DropdownControl>
      </div>
    ))
  );
