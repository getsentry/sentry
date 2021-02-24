import React from 'react';

import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';

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
    value: 'defaults',
    hideGroupLabel: true,
    items: [
      {
        value: 'recent thing',
        label: 'recent thing',
      },
      {
        value: 'other recent thing',
        label: 'other recent thing',
      },
      {
        value: 'yet another recent thing',
        label: 'yet another recent thing',
      },
    ],
  },
  {
    value: 'countries',
    label: (
      <div>
        Countries{' '}
        <a style={{float: 'right'}} href="#">
          + Add
        </a>
      </div>
    ),
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
    value: 'foods',
    label: 'Foods',
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

export default {
  title: 'Core/Buttons/Dropdowns/DropdownAutoComplete',
  component: DropdownAutoComplete,
};

export const Ungrouped = () => (
  <DropdownAutoComplete items={items}>
    {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
  </DropdownAutoComplete>
);

Ungrouped.storyName = 'ungrouped';
Ungrouped.parameters = {
  docs: {
    description: {
      story: 'The item label can be a component or a string',
    },
  },
};

export const Grouped = () => (
  <DropdownAutoComplete
    items={groupedItems}
    virtualizedHeight={44}
    virtualizedLabelHeight={28}
  >
    {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
  </DropdownAutoComplete>
);

Grouped.storyName = 'grouped';
Grouped.parameters = {
  docs: {
    description: {
      story: 'Group labels can receive a component too',
    },
  },
};

export const WithDropdownButton = () => (
  <DropdownAutoComplete items={groupedItems}>
    {({isOpen, selectedItem}) => (
      <DropdownButton isOpen={isOpen}>
        {selectedItem ? selectedItem.label : 'Click me!'}
      </DropdownButton>
    )}
  </DropdownAutoComplete>
);

WithDropdownButton.storyName = 'with dropdownButton';
WithDropdownButton.parameters = {
  docs: {
    description: {
      story: 'Use it with dropdownbutton for maximum fun',
    },
  },
};

export const WithExtraAction = () => (
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
);

WithExtraAction.storyName = 'with extra action';
WithExtraAction.parameters = {
  docs: {
    description: {
      story: 'Add a call to action button',
    },
  },
};
