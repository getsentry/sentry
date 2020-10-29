import React from 'react';

import {EventGroupComponent} from 'app/types';

import GroupingComponent from './groupingComponent';
import {groupingComponentFilter} from './utils';
import GroupingComponentFrames from './groupingComponentFrames';

type FrameGroup = {
  key: string;
  data: EventGroupComponent[];
};

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

const GroupingComponentStacktrace = ({component, showNonContributing}: Props) => {
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

  return (
    <React.Fragment>
      {getFrameGroups().map((group, index) => (
        <GroupingComponentFrames
          key={index}
          items={group.data.map((v, idx) => (
            <GroupingComponent
              key={idx}
              component={v}
              showNonContributing={showNonContributing}
            />
          ))}
        />
      ))}
    </React.Fragment>
  );
};

export default GroupingComponentStacktrace;
