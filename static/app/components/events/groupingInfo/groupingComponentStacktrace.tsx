import {Fragment} from 'react';

import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponent from './groupingComponent';
import GroupingComponentFrames from './groupingComponentFrames';
import {getFrameGroups} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

function GroupingComponentStacktrace({component, showNonContributing}: Props) {
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
          initialCollapsed={!showNonContributing}
        />
      ))}
    </Fragment>
  );
}

export default GroupingComponentStacktrace;
