import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';

export interface FlamegraphViewSelectMenuProps {
  onSortingChange: (sorting: FlamegraphViewSelectMenuProps['sorting']) => void;
  onViewChange: (view: FlamegraphViewSelectMenuProps['view']) => void;
  sorting: FlamegraphPreferences['sorting'];
  view: FlamegraphPreferences['view'];
}

function FlamegraphViewSelectMenu({
  view,
  onViewChange,
  sorting,
  onSortingChange,
}: FlamegraphViewSelectMenuProps): React.ReactElement {
  return (
    <FlamegraphViewSelectMenuWrap>
      <SegmentedControl
        aria-label="Sorting"
        size="xs"
        value={sorting}
        priority="primary"
        onChange={onSortingChange}
      >
        <SegmentedControl.Item
          key="call order"
          tooltip="Stacks appear in chronological order as they were called"
        >
          {t('Call Order')}
        </SegmentedControl.Item>
        <SegmentedControl.Item
          key="alphabetical"
          tooltip="Merges stacks and sorts them alphabetically"
        >
          {t('Alphabetical')}
        </SegmentedControl.Item>
        <SegmentedControl.Item
          key="left heavy"
          tooltip="Merges stacks and sorts them by weights"
        >
          {t('Left Heavy')}
        </SegmentedControl.Item>
      </SegmentedControl>
      <SegmentedControl
        aria-label="View"
        size="xs"
        value={view}
        onChange={onViewChange}
        priority="primary"
      >
        <SegmentedControl.Item key="bottom up">{t('Bottom Up')}</SegmentedControl.Item>
        <SegmentedControl.Item key="top down">{t('Top Down')}</SegmentedControl.Item>
      </SegmentedControl>
    </FlamegraphViewSelectMenuWrap>
  );
}

export {FlamegraphViewSelectMenu};

const FlamegraphViewSelectMenuWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: inherit;
  min-width: max-content;
`;
