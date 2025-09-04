import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponent from './groupingComponent';
import GroupingComponentFrames from './groupingComponentFrames';
import {groupingComponentFilter} from './utils';

type FrameGroup = {
  data: EventGroupComponent[];
  key: string;
};

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
  isCollapsed?: boolean;
  maxVisibleItems?: number;
  onCollapseChange?: (collapsed: boolean) => void;
};

function GroupingComponentStacktrace({
  component,
  showNonContributing,
  isCollapsed = false,
  maxVisibleItems = 2,
  onCollapseChange,
}: Props) {
  const [frameGroupStates, setFrameGroupStates] = useState<boolean[]>([]);

  const frameGroups = useMemo(() => {
    const groups: FrameGroup[] = [];

    (component.values as EventGroupComponent[])
      .filter(value => groupingComponentFilter(value, showNonContributing))
      .forEach(value => {
        const key = (value.values as EventGroupComponent[])
          .filter(v => groupingComponentFilter(v, showNonContributing))
          .map(v => v.id)
          .sort((a, b) => a.localeCompare(b))
          .join('');

        const lastGroup = groups[groups.length - 1];

        if (lastGroup?.key === key) {
          lastGroup.data.push(value);
        } else {
          groups.push({key, data: [value]});
        }
      });

    return groups;
  }, [component.values, showNonContributing]);

  useEffect(() => {
    const initialStates = frameGroups.map(() => isCollapsed);
    setFrameGroupStates(initialStates);
  }, [frameGroups, isCollapsed]);

  const handleFrameGroupCollapseChange = useCallback(
    (index: number, collapsed: boolean) => {
      setFrameGroupStates(prev => {
        const newStates = [...prev];
        newStates[index] = collapsed;
        return newStates;
      });
    },
    []
  );

  // Track when all frame groups change their collapse state to sync with parent
  useEffect(() => {
    if (onCollapseChange && frameGroups.length > 0) {
      // Determine if the overall stacktrace should be considered collapsed
      // If any frame group is expanded (not collapsed), the stacktrace is expanded
      const anyFrameGroupExpanded = frameGroupStates.some(state => !state);
      onCollapseChange(!anyFrameGroupExpanded);
    }
  }, [frameGroupStates, frameGroups.length, onCollapseChange]);

  return (
    <Fragment>
      {frameGroups.map((group, index) => {
        // When parent is collapsed, only show up to maxVisibleItems frame groups
        if (isCollapsed && index >= maxVisibleItems) {
          return null;
        }

        const groupIsCollapsed = frameGroupStates[index] ?? isCollapsed;
        const hasMultipleFrames = group.data.length > 2;

        return (
          <FrameGroupContainer key={index}>
            <GroupingComponentFrames
              items={group.data.map((v, idx) => (
                <GroupingComponent
                  key={idx}
                  component={v}
                  showNonContributing={showNonContributing}
                  maxVisibleItems={maxVisibleItems}
                />
              ))}
              initialCollapsed={groupIsCollapsed}
              onCollapseChange={collapsed =>
                handleFrameGroupCollapseChange(index, collapsed)
              }
              maxVisibleItems={hasMultipleFrames ? 2 : undefined}
            />
          </FrameGroupContainer>
        );
      })}
    </Fragment>
  );
}

const FrameGroupContainer = styled('div')`
  margin-bottom: ${space(2)};
  position: relative;
`;

export default GroupingComponentStacktrace;
