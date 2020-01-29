import React from 'react';
import styled from '@emotion/styled';
import {ClassNames} from '@emotion/core';

import {Thread} from 'app/types/events';
import {Event} from 'app/types';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';

import filterThreadInfo from './filter-thread-info';
import ThreadsSelectorOption from './ThreadsSelectorOption';
import ThreadsSelectorSelectedOption from './ThreadsSelectorSelectedOption';

interface Props {
  threads: Array<Thread>;
  activeThread: Thread;
  event: Event;
  onChange?: (Thread: Thread) => void;
}

const ThreadsSelector: React.FC<Props> = ({threads, event, activeThread, onChange}) => {
  console.log('PRISCILA');
  return <div>oioioioio</div>;
  return (
    <ClassNames>
      {({css}) => (
        <DropdownAutoComplete
          // className={css`
          //   width: 700px;
          // `}
          items={threads.map(thread => ({
            value: 'okokoko',
            label: 'oioioioi',
            thread,
          }))}
          alignMenu="left"
          maxHeight={400}
        >
          {({isOpen, selectedItem}) => (
            // <StyledDropdownButton isOpen={isOpen} align="left">
            //   {selectedItem ? (
            //     <ThreadsSelectorSelectedOption
            //       id={selectedItem.thread.id}
            //       frame={filterThreadInfo(selectedItem.thread, event, false)}
            //     />
            //   ) : (
            //     <ThreadsSelectorSelectedOption
            //       id={activeThread.id}
            //       frame={filterThreadInfo(activeThread, event, true)}
            //     />
            //   )}
            // </StyledDropdownButton>
            <div>test</div>
          )}
        </DropdownAutoComplete>
      )}
    </ClassNames>
  );
};

export default ThreadsSelector;

const StyledDropdownButton = styled(DropdownButton)({
  width: '100%',
});
