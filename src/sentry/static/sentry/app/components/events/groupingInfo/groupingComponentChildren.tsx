import React from 'react';
import isObject from 'lodash/isObject';

import {EventGroupComponent} from 'app/types';

import GroupingComponent, {
  GroupingValue,
  GroupingComponentListItem,
} from './groupingComponent';
import {groupingComponentFilter} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

const GroupingComponentChildren = ({component, showNonContributing}: Props) => {
  return (
    <React.Fragment>
      {(component.values as EventGroupComponent[])
        .filter(value => groupingComponentFilter(value, showNonContributing))
        .map((value, idx) => (
          <GroupingComponentListItem key={idx}>
            {isObject(value) ? (
              <GroupingComponent
                component={value}
                showNonContributing={showNonContributing}
              />
            ) : (
              <GroupingValue valueType={component.name || component.id}>
                {typeof value === 'string' || typeof value === 'number'
                  ? value
                  : JSON.stringify(value, null, 2)}
              </GroupingValue>
            )}
          </GroupingComponentListItem>
        ))}
    </React.Fragment>
  );
};

export default GroupingComponentChildren;
