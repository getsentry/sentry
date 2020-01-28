import React from 'react';

import {Thread} from 'app/types/events';
import {Event} from 'app/types';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';

const groupedItems = [
  {
    value: 'defaults',
    hideGroupLabel: true,
  },
  {
    value: 'foods',
    label: 'Foods',
  },
];

interface Props {
  threads: Array<Thread>;
  event: Event;
}

const ThreadsSelector: React.FC<Props> = ({threads, event}) => {
  return (
    <DropdownAutoComplete
      items={threads.map(thread => ({
        value: thread,
        label: thread.name,
      }))}
      alignMenu="left"
    >
      {({isOpen, selectedItem}) => (
        <DropdownButton isOpen={isOpen}>{selectedItem ? `` : 'Click me!'}</DropdownButton>
      )}
    </DropdownAutoComplete>
  );
};

export default ThreadsSelector;
