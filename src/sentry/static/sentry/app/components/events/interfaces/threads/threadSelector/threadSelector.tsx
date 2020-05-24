import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Thread} from 'app/types/events';
import {Event, EntryTypeData} from 'app/types';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import theme from 'app/utils/theme';
import {t} from 'app/locale';
import {IconChevron} from 'app/icons';

import {filterThreadInfo} from './filterThreadInfo';
import {getThreadException} from './getThreadException';
import {Option} from './option';
import {SelectedOption} from './selectedOption';
import {Header} from './header';

type Props = {
  threads: Array<Thread>;
  activeThread: Thread;
  event: Event;
  onChange?: (thread: Thread) => void;
};

const DROPDOWN_MAX_HEIGHT = 400;

const ThreadSelector = ({threads, event, activeThread, onChange}: Props) => {
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
        <Option
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
      items={threads.map(getDropDownItem)}
      onSelect={handleOnChange}
      align="left"
      alignMenu="left"
      maxHeight={DROPDOWN_MAX_HEIGHT}
      placeholder={t('Filter Threads')}
      emptyMessage={t('You have no threads')}
      noResultsMessage={t('No threads found')}
      zIndex={theme.zIndex.dropdown}
      css={css`
        width: 100%;
        @media (min-width: ${theme.breakpoints[2]}) {
          width: 550px;
        }
      `}
      menuHeader={<Header />}
      closeOnSelect
      emptyHidesInput
    >
      {({isOpen, selectedItem}) => (
        <StyledDropdownButton size="small" isOpen={isOpen} align="left">
          {selectedItem ? (
            <SelectedOption
              id={selectedItem.thread.id}
              details={selectedItem.threadInfo}
            />
          ) : (
            <SelectedOption
              id={activeThread.id}
              details={filterThreadInfo(activeThread, event)}
            />
          )}
        </StyledDropdownButton>
      )}
    </StyledDropdownAutoComplete>
  );
};

export default ThreadSelector;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  background: #fff;
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
`;
