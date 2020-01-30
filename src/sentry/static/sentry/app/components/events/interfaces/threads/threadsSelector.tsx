/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';
import {ClassNames} from '@emotion/core';

import {Thread} from 'app/types/events';
import {Event, EntryTypeData} from 'app/types';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import filterThreadInfo from './filter-thread-info';
import getThreadException from './get-thread-exception';
import ThreadsSelectorOption from './threadsSelectorOption';
import ThreadsSelectorSelectedOption from './threadsSelectorSelectedOption';

interface Props {
  threads: Array<Thread>;
  activeThread: Thread;
  event: Event;
  onChange?: (Thread: Thread) => void;
}

const DROPDOWN_MAX_HEIGHT = 400;
const NOT_FOUND_FRAME = '<unknown>';

const ThreadsSelector: React.FC<Props> = ({threads, event, activeThread, onChange}) => {
  const getDropDownItem = (thread: Thread) => {
    const threadInfo = filterThreadInfo(thread, event, false);

    let dropDownValue = `#${thread.id}: ${thread.name} ${threadInfo.label} ${threadInfo.filename}`;
    let crashedInfo: undefined | EntryTypeData = undefined;

    if (threadInfo.label !== NOT_FOUND_FRAME) {
      dropDownValue = `#${thread.id}: ${thread.name} ${threadInfo.label.value} ${threadInfo.filename}`;
    }

    if (thread.crashed) {
      crashedInfo = getThreadException(thread, event);
    }

    return {
      value: dropDownValue,
      threadInfo,
      thread,
      label: (
        <ThreadsSelectorOption
          id={thread.id}
          details={threadInfo}
          name={thread.name}
          crashedInfo={crashedInfo}
        />
      ),
    };
  };

  const handleOnChange = ({thread}) => {
    if (onChange) {
      onChange(thread);
    }
  };

  return (
    <ClassNames>
      {({css}) => (
        <DropdownAutoComplete
          items={threads.map(getDropDownItem)}
          onSelect={handleOnChange}
          align="left"
          alignMenu="left"
          maxHeight={DROPDOWN_MAX_HEIGHT}
          // TODO(fix): unfortunately the dropDown is playing well with emotion js
          className={css`
            width: 100%;
            @media (min-width: ${theme.breakpoints[0]}) {
              width: 700px;
            }
          `}
          rootClassName={css`
            width: 100%;
            @media (min-width: ${theme.breakpoints[0]}) {
              width: auto;
            }
          `}
        >
          {({isOpen, selectedItem}) => (
            <StyledDropdownButton isOpen={isOpen} align="left">
              {selectedItem ? (
                <ThreadsSelectorSelectedOption
                  id={selectedItem.thread.id}
                  details={selectedItem.threadInfo}
                />
              ) : (
                <ThreadsSelectorSelectedOption
                  id={activeThread.id}
                  details={filterThreadInfo(activeThread, event, true)}
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

const StyledDropdownButton = styled(DropdownButton)(({theme: {breakpoints}}) => ({
  width: '100%',
  marginBottom: space(1),
  [`@media (min-width: ${breakpoints[0]})`]: {
    width: 420,
    marginBottom: space(0),
  },
}));
