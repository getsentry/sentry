import {Fragment} from 'react';

import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
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
  const getFrameGroups = () => {
    const frameGroups: FrameGroup[] = [];

    const frames = isStacktraceNewestFirst()
      ? component.values.reverse()
      : component.values;
    (frames as EventGroupComponent[])
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
    <Fragment>
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
    </Fragment>
  );
}

export default GroupingComponentStacktrace;
