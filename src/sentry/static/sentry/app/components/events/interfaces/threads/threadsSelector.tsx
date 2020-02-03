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

import filterThreadInfo from './filterThreadInfo';
import getThreadException from './getThreadException';
import ThreadsSelectorOption from './threadsSelectorOption';
import ThreadsSelectorSelectedOption from './threadsSelectorSelectedOption';

type Props = {
  threads: Array<Thread>;
  activeThread: Thread;
  event: Event;
  onChange?: (thread: Thread) => void;
};

const DROPDOWN_MAX_HEIGHT = 400;

const ThreadsSelector: React.FC<Props> = ({threads, event, activeThread, onChange}) => {
  const getDropDownItem = (thread: Thread) => {
    const threadInfo = filterThreadInfo(thread, event, false);

    const dropDownValue = `#${thread.id}: ${thread.name} ${threadInfo.label} ${threadInfo.filename}`;
    let crashedInfo: undefined | EntryTypeData;

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
          crashed={thread.crashed}
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
          // TODO(fix): unfortunately the dropDown is not playing well with emotion js
          className={css`
            width: 100%;
            @media (min-width: ${theme.breakpoints[2]}) {
              width: 700px;
            }
          `}
          rootClassName={css`
            width: 100%;
            flex: 1;
            margin-bottom: ${space(1)};
            @media (min-width: ${theme.breakpoints[2]}) {
              width: auto;
              flex: initial;
              margin-bottom: ${space(0)};
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

const StyledDropdownButton = styled(DropdownButton)`
  width: 100%;
  > *:first-child {
    grid-template-columns: 1fr 15px;
  }
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    width: 420px;
  }
`;
