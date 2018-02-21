import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownAutoComplete from 'sentry-ui/dropdownAutoComplete';
import DropdownButton from 'sentry-ui/dropdownButton';

const items = [
  {
    group: {
      value: 'countries',
      label: (
        <div>
          Countries{' '}
          <a style={{float: 'right'}} href="#">
            + Add
          </a>
        </div>
      ),
    },
    items: [
      {
        value: 'new zealand',
        label: <div>🇨🇷 New Zealand</div>,
      },
      {
        value: 'australia',
        label: <div>🇦🇺 Australia</div>,
      },
      {
        value: 'brazil',
        label: <div>🇧🇷 Brazil</div>,
      },
    ],
  },
  {
    group: {
      value: 'foods',
      label: 'Foods',
    },
    items: [
      {
        value: 'apple',
        label: <div>🍎 Apple</div>,
      },
      {
        value: 'bacon',
        label: <div>🥓 Bacon</div>,
      },
      {
        value: 'corn',
        label: <div>🌽 Corn</div>,
      },
    ],
  },
];

storiesOf('DropdownButton', module).add(
  'default',
  withInfo('A button meant to be used with some sort of dropdown')(() => (
    <DropdownAutoComplete items={items}>
      {({isOpen, selectedItem}) => (
        <DropdownButton isOpen={isOpen}>
          {selectedItem ? selectedItem.label : 'Click me!'}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  ))
);
