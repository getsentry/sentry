import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {getMappedThreadState} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {t} from 'sentry/locale';
import {Event, ExceptionType, Frame, Thread} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';

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

function ThreadSelector({
  threads,
  event,
  exception,
  activeThread,
  onChange,
  fullWidth = false,
}: Props) {
  const organization = useOrganization({allowNull: true});
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

  const items = getItems();

  return (
    <ClassNames>
      {({css}) => (
        <StyledDropdownAutoComplete
          detached
          data-test-id="thread-selector"
          items={items}
          onOpen={() => {
            trackAnalytics('stack_trace.threads.thread_selector_opened', {
              organization,
              platform: event.platform,
              num_threads: items.length,
            });
          }}
          onSelect={item => {
            const selectedThread: Thread = item.thread;

            trackAnalytics('stack_trace.threads.thread_selected', {
              organization,
              platform: event.platform,
              thread_index: items.findIndex(
                ({thread}) => thread.id === selectedThread.id
              ),
              num_threads: items.length,
              is_crashed_thread: selectedThread.crashed,
              is_current_thread: selectedThread.current,
              thread_state: selectedThread.state ?? '',
              has_stacktrace: defined(selectedThread.stacktrace),
              num_in_app_frames:
                selectedThread.stacktrace?.frames?.filter((frame: Frame) => frame.inApp)
                  .length ?? 0,
            });
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
                  name={selectedItem.thread.name}
                  details={selectedItem.threadInfo}
                />
              ) : (
                <SelectedOption
                  id={activeThread.id}
                  name={activeThread.name}
                  details={filterThreadInfo(event, activeThread, exception)}
                />
              )}
            </StyledDropdownButton>
          )}
        </StyledDropdownAutoComplete>
      )}
    </ClassNames>
  );
}

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
