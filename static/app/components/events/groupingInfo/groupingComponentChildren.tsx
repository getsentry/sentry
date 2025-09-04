import {Fragment} from 'react';

import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponent, {
  GroupingComponentListItem,
  GroupingValue,
} from './groupingComponent';
import {groupingComponentFilter} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
  isCollapsed?: boolean;
  maxVisibleItems?: number;
  onCollapseChange?: (collapsed: boolean) => void;
};

function GroupingComponentChildren({
  component,
  showNonContributing,
  isCollapsed: _isCollapsed,
  maxVisibleItems,
  onCollapseChange: _onCollapseChange,
}: Props) {
  return (
    <Fragment>
      {component.values
        .filter((value: any) => groupingComponentFilter(value, showNonContributing))
        .map((value: any) => {
          return (
            <GroupingComponentListItem key={typeof value === 'object' ? value.id : value}>
              {typeof value === 'object' ? (
                <GroupingComponent
                  component={value}
                  showNonContributing={showNonContributing}
                  maxVisibleItems={maxVisibleItems}
                />
              ) : (
                <GroupingValue
                  valueType={component.name || component.id}
                  contributes={component.contributes}
                >
                  {typeof value === 'string' || typeof value === 'number'
                    ? value
                    : JSON.stringify(value, null, 2)}
                </GroupingValue>
              )}
            </GroupingComponentListItem>
          );
        })}
    </Fragment>
  );
}

export default GroupingComponentChildren;
