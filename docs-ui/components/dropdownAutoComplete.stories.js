import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Button from 'sentry-ui/buttons/button';
import DropdownAutoComplete from 'sentry-ui/dropdownAutoComplete';
import DropdownButton from 'sentry-ui/dropdownButton';

const items = [
  {
    value: 'apple',
    label: '🍎 Apple',
  },
  {
    value: 'bacon',
    label: '🥓 Bacon',
  },
  {
    value: 'corn',
    label: '🌽 Corn',
  },
];

const groupedItems = [
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

storiesOf('DropdownAutoComplete', module)
  .add(
    'ungrouped',
    withInfo('The item label can be a component or a string')(() => (
      <DropdownAutoComplete items={items}>
        {({isOpen, selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoComplete>
    ))
  )
  .add(
    'grouped',
    withInfo('Group labels can receive a component too')(() => (
      <DropdownAutoComplete items={groupedItems}>
        {({isOpen, selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoComplete>
    ))
  )
  .add(
    'with dropdownButton',
    withInfo('Use it with dropdownbutton for maximum fun')(() => (
      <DropdownAutoComplete items={groupedItems}>
        {({isOpen, selectedItem}) => (
          <DropdownButton isOpen={isOpen}>
            {selectedItem ? selectedItem.label : 'Click me!'}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    ))
  )
  .add(
    'with extra action',
    withInfo('Add a call to action button')(() => (
      <DropdownAutoComplete
        items={items}
        action={<Button priority="primary">Now click me!</Button>}
      >
        {({isOpen, selectedItem}) => (
          <DropdownButton isOpen={isOpen}>
            {selectedItem ? selectedItem.label : 'Click me!'}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    ))
  );
