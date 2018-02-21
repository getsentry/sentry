import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownAutoComplete from 'sentry-ui/dropdownAutoComplete';
import DropdownButton from 'sentry-ui/dropdownButton';

const items = [
  {
    groupLabel: (
      <div>
        Countries{' '}
        <a style={{float: 'right'}} href="#">
          + Add
        </a>
      </div>
    ),
    groupItems: [
      {
        searchKey: 'new zealand',
        content: <div>🇨🇷 New Zealand</div>,
      },
      {
        searchKey: 'australia',
        content: <div>🇦🇺 Australia</div>,
      },
      {
        searchKey: 'brazil',
        content: <div>🇧🇷 Brazil</div>,
      },
    ],
  },
  {
    groupLabel: 'Foods',
    groupItems: [
      {
        searchKey: 'apple',
        content: <div>🍎 Apple</div>,
      },
      {
        searchKey: 'bacon',
        content: <div>🥓 Bacon</div>,
      },
      {
        searchKey: 'corn',
        content: <div>🌽 Corn</div>,
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
          {selectedItem ? selectedItem.content : 'Click me!'}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  ))
);
