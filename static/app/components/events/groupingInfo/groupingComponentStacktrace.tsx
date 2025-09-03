import {Fragment, useState} from 'react';
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
  const [allCollapsed, setAllCollapsed] = useState(false);

  const getFrameGroups = () => {
    const frameGroups: FrameGroup[] = [];

    (component.values as EventGroupComponent[])
      .filter(value => groupingComponentFilter(value, showNonContributing))
      .forEach(value => {
        const key = (value.values as EventGroupComponent[])
          .filter(v => groupingComponentFilter(v, showNonContributing))
          .map(v => v.id)
          .sort((a, b) => a.localeCompare(b))
          .join('');

        const lastGroup = frameGroups[frameGroups.length - 1];

        if (lastGroup?.key === key) {
          lastGroup.data.push(value);
        } else {
          frameGroups.push({key, data: [value]});
        }
      });

    return frameGroups;
  };

  const frameGroups = getFrameGroups();
  const hasCollapsibleGroups = frameGroups.some(group => group.data.length > 2);

  return (
    <Fragment>
      {hasCollapsibleGroups && (
        <CollapseAllContainer>
          <Button
            size="sm"
            priority="link"
            icon={<IconSubtract legacySize="8px" />}
            onClick={() => setAllCollapsed(!allCollapsed)}
          >
            {allCollapsed ? t('expand all') : t('collapse all')}
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
          initialCollapsed={!showNonContributing || allCollapsed}
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
