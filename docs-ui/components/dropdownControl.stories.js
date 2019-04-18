import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text, boolean} from '@storybook/addon-knobs';

import DropdownControl from 'app/components/dropdownControl';
import MenuItem from 'app/components/menuItem';

storiesOf('UI|Dropdowns/DropdownControl', module)
  .add(
    'basic label + knobs',
    withInfo('Using a string value for the button label')(() => {
      const menuWidth = text('menuWidth', undefined);
      const menuOffset = text('menuOffset', undefined);
      const alwaysRenderMenu = boolean('alwaysRenderMenu', true);

      return (
        <div className="clearfix">
          <DropdownControl
            label="Open Me"
            menuWidth={menuWidth}
            menuOffset={menuOffset}
            alwaysRenderMenu={alwaysRenderMenu}
          >
            <MenuItem href="">Item</MenuItem>
            <MenuItem href="">Item</MenuItem>
          </DropdownControl>
        </div>
      );
    })
  )
  .add(
    'element label',
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
    'custom button',
    withInfo('button prop lets you replace the entire button.')(() => (
      <div className="clearfix">
        <DropdownControl
          button={({isOpen, getActorProps}) => (
            <button {...getActorProps()}>click me</button>
          )}
        >
          <MenuItem href="">Item</MenuItem>
          <MenuItem href="">Item</MenuItem>
        </DropdownControl>
      </div>
    ))
  );
