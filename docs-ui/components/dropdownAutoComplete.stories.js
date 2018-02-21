import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownAutoComplete from 'sentry-ui/dropdownAutoComplete';

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

storiesOf('DropdownAutoComplete', module).add(
  'default',
  withInfo('A flexible dropdown with autocomplete and grouping')(() => (
    <DropdownAutoComplete items={items}>
      {({isOpen, selectedItem}) => (selectedItem ? selectedItem.content : 'Click me!')}
    </DropdownAutoComplete>
  ))
);
