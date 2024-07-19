import {Fragment} from 'react';

import type {EventGroupComponent} from 'sentry/types';

import GroupingComponent, {
  GroupingComponentListItem,
  GroupingValue,
} from './groupingComponent';
import {groupingComponentFilter} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

function GroupingComponentChildren({component, showNonContributing}: Props) {
  return (
    <Fragment>
      {(component.values as EventGroupComponent[])
        .filter(value => groupingComponentFilter(value, showNonContributing))
        .map(value => (
          <GroupingComponentListItem key={value.id}>
            {typeof value === 'object' ? (
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
    </Fragment>
  );
}

export default GroupingComponentChildren;
