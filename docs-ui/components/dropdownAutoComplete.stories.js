import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownAutoComplete from 'sentry-ui/dropdownAutoComplete';

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

storiesOf('DropdownAutoComplete', module).add(
  'default',
  withInfo('A flexible dropdown with autocomplete and grouping')(() => (
    <DropdownAutoComplete items={items}>
      {({isOpen, selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
    </DropdownAutoComplete>
  ))
);
