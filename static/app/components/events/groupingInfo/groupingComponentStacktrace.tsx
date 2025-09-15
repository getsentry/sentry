import {Fragment} from 'react';

import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponent from './groupingComponent';
import GroupingComponentFrames from './groupingComponentFrames';
import {getFrameGroups} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

function GroupingComponentStacktrace({
  component,
  showNonContributing,
  onCollapsedChange,
  collapsed = false,
}: Props) {
  return (
    <Fragment>
      {getFrameGroups(component, showNonContributing).map((group, index) => (
        <GroupingComponentFrames
          key={index}
          items={group.data.map((v, idx) => (
            <GroupingComponent
              key={idx}
              component={v}
              showNonContributing={showNonContributing}
            />
          ))}
          collapsed={collapsed}
          onCollapsedChange={onCollapsedChange}
        />
      ))}
    </Fragment>
  );
}

export default GroupingComponentStacktrace;
