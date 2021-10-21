import {useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {SelectValue} from 'app/types';
import {EntryType, Event} from 'app/types/event';
import BooleanField from 'app/views/settings/components/forms/booleanField';

import ThreadSelector from '../threads/threadSelector';

enum SortOption {
  RECENT_FIRST = 'recent-first',
  RECENT_LAST = 'recent-last',
}

const SORT_OPTIONS: SelectValue<string>[] = [
  {label: t('Recent first'), value: SortOption.RECENT_FIRST},
  {label: t('Recent last'), value: SortOption.RECENT_LAST},
];

type Props = {
  type: EntryType.THREADS | EntryType.EXCEPTION | EntryType.STACKTRACE;
  event: Event;
};

type State = {
  raw: boolean;
  activeSort: SortOption;
};

function Trace({type, event}: Props) {
  const [state, setState] = useState<State>({
    raw: false,
    activeSort: SortOption.RECENT_FIRST,
  });

  function getTitle() {
    switch (type) {
      case EntryType.EXCEPTION:
        return (
          <GuideAnchor target="exception" position="bottom">
            <h3>{t('Exception')}</h3>
          </GuideAnchor>
        );
      case EntryType.STACKTRACE:
        return (
          <GuideAnchor target="stack-trace" position="bottom">
            <h3>{t('Stack Trace')}</h3>
          </GuideAnchor>
        );
      case EntryType.THREADS:
        return (
          <ThreadSelector
            threads={[]}
            activeThread={{}}
            event={event}
            onChange={() => {}}
            exception={{}}
          />
        );
      default:
        return '';
    }
  }

  function handleSortChange(value: SortOption) {
    setState({...state, activeSort: value});
  }

  const {raw, activeSort} = state;

  const activeSortOption =
    SORT_OPTIONS.find(sortOption => sortOption.value === activeSort) ?? SORT_OPTIONS[0];

  return (
    <EventDataSection
      type={type}
      title={getTitle()}
      wrapTitle={false}
      showPermalink={type !== EntryType.THREADS}
      actions={
        <div>
          <RawToggler
            name="raw-stack-trace"
            label={t('Raw')}
            hideControlState
            value={raw}
            onChange={() => setState({...state, raw: !raw})}
          />
          <DropdownControl
            buttonProps={{prefix: t('Sort By')}}
            label={activeSortOption.label}
          >
            {SORT_OPTIONS.map(({label, value}) => (
              <DropdownItem
                key={value}
                onSelect={handleSortChange}
                eventKey={value}
                isActive={value === activeSortOption.value}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>
        </div>
      }
    >
      {null}
    </EventDataSection>
  );
}

export default Trace;

const RawToggler = styled(BooleanField)`
  padding: 0;
  display: grid;
  grid-template-columns: auto max-content;
  grid-gap: ${space(1)};

  && {
    > * {
      padding: 0;
      width: auto;
    }
  }
`;
