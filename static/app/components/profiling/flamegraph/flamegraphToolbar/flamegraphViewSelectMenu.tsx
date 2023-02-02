import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import useOrganization from 'sentry/utils/useOrganization';

export interface FlamegraphViewSelectMenuProps {
  onSortingChange: (sorting: FlamegraphViewSelectMenuProps['sorting']) => void;
  onTypeChange: (type: FlamegraphViewSelectMenuProps['type']) => void;
  onViewChange: (view: FlamegraphViewSelectMenuProps['view']) => void;
  sorting: FlamegraphPreferences['sorting'];
  type: FlamegraphPreferences['type'];
  view: FlamegraphPreferences['view'];
}

function FlamegraphViewSelectMenu({
  view,
  type,
  onViewChange,
  sorting,
  onTypeChange,
  onSortingChange,
}: FlamegraphViewSelectMenuProps): React.ReactElement {
  const organization = useOrganization();
  const hasFlamegraphs = useMemo(
    () => organization.features.includes('profiling-flamegraphs'),
    [organization.features]
  );

  return (
    <FlamegraphViewSelectMenuWrap>
      {hasFlamegraphs ? (
        <SegmentedControl
          aria-label="Type"
          size="xs"
          value={type}
          onChange={onTypeChange}
          priority="primary"
        >
          <SegmentedControl.Item key="flamegraph">
            {t('Flamegraph')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="flamechart">
            {t('Flamechart')}
          </SegmentedControl.Item>
        </SegmentedControl>
      ) : null}
      <SegmentedControl
        aria-label="Sorting"
        size="xs"
        value={sorting}
        onChange={onSortingChange}
      >
        <SegmentedControl.Item key="call order">{t('Call Order')}</SegmentedControl.Item>
        <SegmentedControl.Item key="left heavy">{t('Left Heavy')}</SegmentedControl.Item>
      </SegmentedControl>
      <SegmentedControl aria-label="View" size="xs" value={view} onChange={onViewChange}>
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
