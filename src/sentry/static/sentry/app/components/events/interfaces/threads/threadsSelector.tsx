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
  const handleOnChange = ({thread}) => {
    if (onChange) {
      onChange(thread);
    }
  };
  return (
    <ClassNames>
      {({css}) => (
        <DropdownAutoComplete
          items={threads.map(thread => {
            const frame = filterThreadInfo(thread, event, false);
            return {
              label: (
                <ThreadsSelectorOption
                  id={thread.id}
                  frame={frame}
                  crashed={thread.crashed}
                  name={thread.name}
                />
              ),
              frame,
              thread,
            };
          })}
          onSelect={handleOnChange}
          align="left"
          alignMenu="left"
          maxHeight={400}
          className={css`
            width: 700px;
          `}
        >
          {({isOpen, selectedItem}) => (
            <StyledDropdownButton isOpen={isOpen} align="left">
              {selectedItem ? (
                <ThreadsSelectorSelectedOption
                  id={selectedItem.thread.id}
                  frame={selectedItem.frame}
                />
              ) : (
                <ThreadsSelectorSelectedOption
                  id={activeThread.id}
                  frame={filterThreadInfo(activeThread, event, true)}
                />
              )}
            </StyledDropdownButton>
          )}
        </DropdownAutoComplete>
      )}
    </ClassNames>
  );
};

export default ThreadsSelector;

const StyledDropdownButton = styled(DropdownButton)({
  width: 420,
});
