import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Thread} from 'app/types/events';
import {Event, EntryTypeData} from 'app/types';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import theme from 'app/utils/theme';
import {t} from 'app/locale';

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

const ThreadsSelector = ({threads, event, activeThread, onChange}: Props) => {
  const getDropDownItem = (thread: Thread) => {
    const threadInfo = filterThreadInfo(thread, event);

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
    <StyledDropdownAutoComplete
      closeOnSelect
      emptyHidesInput
      items={threads.map(getDropDownItem)}
      onSelect={handleOnChange}
      align="left"
      alignMenu="left"
      maxHeight={DROPDOWN_MAX_HEIGHT}
      placeholder={t('Filter Threads')}
      emptyMessage={t('You have no threads')}
      noResultsMessage={t('No threads found')}
      zIndex={theme.zIndex.dropdown}
      className={css`
        width: 100%;
        @media (min-width: ${theme.breakpoints[2]}) {
          width: 400px;
        }
      `}
    >
      {({isOpen, selectedItem}) => (
        <StyledDropdownButton size="small" isOpen={isOpen} align="left">
          {selectedItem ? (
            <ThreadsSelectorSelectedOption
              id={selectedItem.thread.id}
              details={selectedItem.threadInfo}
            />
          ) : (
            <ThreadsSelectorSelectedOption
              id={activeThread.id}
              details={filterThreadInfo(activeThread, event)}
            />
          )}
        </StyledDropdownButton>
      )}
    </StyledDropdownAutoComplete>
  );
};

export default ThreadsSelector;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderDark};
  position: absolute;
  top: 100%;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadiusBottom};
  margin-top: 0;
  min-width: 100%;
`;

const StyledDropdownButton = styled(DropdownButton)`
  width: 100%;
  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 210px;
  }
  ${p => p.isOpen && `z-index: ${p.theme.zIndex.dropdownAutocomplete.actor}`};
`;
