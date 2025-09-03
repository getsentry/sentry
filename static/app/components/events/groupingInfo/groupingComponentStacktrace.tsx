import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
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
};

function GroupingComponentStacktrace({component, showNonContributing}: Props) {
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

  const hasCollapsibleGroups = frameGroups.some(group => group.data.length > 2);

  useEffect(() => {
    const initialStates = frameGroups.map(() => !showNonContributing);
    setFrameGroupStates(initialStates);
  }, [frameGroups, showNonContributing]);

  const areAllCollapsed =
    frameGroupStates.length > 0 && frameGroupStates.every(state => state);

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

  const handleCollapseAll = useCallback(() => {
    const newCollapsedState = !areAllCollapsed;
    setFrameGroupStates(frameGroups.map(() => newCollapsedState));
  }, [areAllCollapsed, frameGroups]);

  return (
    <Fragment>
      {hasCollapsibleGroups && (
        <CollapseAllContainer>
          <Button
            size="sm"
            priority="link"
            icon={<IconSubtract legacySize="8px" />}
            onClick={handleCollapseAll}
          >
            {areAllCollapsed ? t('expand all') : t('collapse all')}
          </Button>
        </CollapseAllContainer>
      )}
      {frameGroups.map((group, index) => (
        <GroupingComponentFrames
          key={index}
          items={group.data.map((v, idx) => (
            <GroupingComponent
              key={idx}
              component={v}
              showNonContributing={showNonContributing}
            />
          ))}
          initialCollapsed={frameGroupStates[index] ?? !showNonContributing}
          onCollapseChange={collapsed => handleFrameGroupCollapseChange(index, collapsed)}
        />
      ))}
    </Fragment>
  );
}

const CollapseAllContainer = styled('div')`
  display: flex;
  justify-content: flex-start;
  margin-bottom: ${space(1)};
`;

export default GroupingComponentStacktrace;
