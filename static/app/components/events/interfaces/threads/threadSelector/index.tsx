import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {getMappedThreadState} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {t} from 'sentry/locale';
import {Event, ExceptionType, Thread} from 'sentry/types';
import {defined} from 'sentry/utils';
import theme from 'sentry/utils/theme';

import filterThreadInfo from './filterThreadInfo';
import Header from './header';
import Option from './option';
import SelectedOption from './selectedOption';

type Props = {
  activeThread: Thread;
  event: Event;
  threads: Array<Thread>;
  exception?: Required<ExceptionType>;
  fullWidth?: boolean;
  onChange?: (thread: Thread) => void;
};

const DROPDOWN_MAX_HEIGHT = 400;

const ThreadSelector = ({
  threads,
  event,
  exception,
  activeThread,
  onChange,
  fullWidth = false,
}: Props) => {
  const hasThreadStates = threads.some(thread =>
    defined(getMappedThreadState(thread.state))
  );

  const getDropDownItem = (thread: Thread) => {
    const {label, filename, crashedInfo, state} = filterThreadInfo(
      event,
      thread,
      exception
    );
    const threadInfo = {label, filename, state};
    return {
      value: `#${thread.id}: ${thread.name} ${label} ${filename}`,
      threadInfo,
      thread,
      label: (
        <Option
          id={thread.id}
          details={threadInfo}
          name={thread.name}
          crashed={thread.crashed}
          crashedInfo={crashedInfo}
          hasThreadStates={hasThreadStates}
        />
      ),
    };
  };

  const getItems = () => {
    const [crashed, notCrashed] = partition(threads, thread => !!thread?.crashed);
    return [...crashed, ...notCrashed].map(getDropDownItem);
  };

  const handleChange = (thread: Thread) => {
    if (onChange) {
      onChange(thread);
    }
  };

  return (
    <ClassNames>
      {({css}) => (
        <StyledDropdownAutoComplete
          detached
          data-test-id="thread-selector"
          items={getItems()}
          onSelect={item => {
            handleChange(item.thread);
          }}
          maxHeight={DROPDOWN_MAX_HEIGHT}
          searchPlaceholder={t('Filter Threads')}
          emptyMessage={t('You have no threads')}
          noResultsMessage={t('No threads found')}
          menuHeader={<Header hasThreadStates={hasThreadStates} />}
          rootClassName={
            fullWidth
              ? css`
                  width: 100%;
                `
              : undefined
          }
          closeOnSelect
          emptyHidesInput
        >
          {({isOpen, selectedItem}) => (
            <StyledDropdownButton isOpen={isOpen} size="xs">
              {selectedItem ? (
                <SelectedOption
                  id={selectedItem.thread.id}
                  details={selectedItem.threadInfo}
                />
              ) : (
                <SelectedOption
                  id={activeThread.id}
                  details={filterThreadInfo(event, activeThread, exception)}
                />
              )}
            </StyledDropdownButton>
          )}
        </StyledDropdownAutoComplete>
      )}
    </ClassNames>
  );
};

export default ThreadSelector;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  min-width: 300px;
  @media (min-width: ${theme.breakpoints.small}) {
    width: 500px;
  }
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    top: calc(100% - 2px);
  }
`;

const StyledDropdownButton = styled(DropdownButton)`
  > *:first-child {
    justify-content: space-between;
    width: 100%;
  }
  width: 100%;
  min-width: 150px;
`;
