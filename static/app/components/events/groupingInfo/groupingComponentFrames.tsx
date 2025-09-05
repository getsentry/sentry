import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {GroupingComponentListItem} from './groupingComponent';

interface GroupingComponentFramesProps {
  initialCollapsed: boolean;
  items: React.ReactNode[];
  collapsed?: boolean;
  maxVisibleItems?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function GroupingComponentFrames({
  items,
  maxVisibleItems = 2,
  initialCollapsed,
  onCollapsedChange,
  collapsed,
}: GroupingComponentFramesProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);

  const isCollapsible = items.length > maxVisibleItems;

  useEffect(() => {
    if (collapsed === undefined) {
      setInternalCollapsed(initialCollapsed);
    }
  }, [initialCollapsed, collapsed]);

  const isControlled = collapsed !== undefined;
  const value = isControlled ? collapsed : internalCollapsed;

  const setCollapsed = (next: boolean) => {
    if (!isControlled) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <Fragment>
      {items.map((item, index) => {
        if (!value || index < maxVisibleItems) {
          return (
            <GroupingComponentListItem isCollapsible={isCollapsible} key={index}>
              {item}
            </GroupingComponentListItem>
          );
        }

        if (index === maxVisibleItems) {
          return (
            <GroupingComponentListItem key={index}>
              <ToggleCollapse
                size="sm"
                priority="link"
                icon={<IconAdd legacySize="8px" />}
                onClick={() => setCollapsed(false)}
              >
                {tct('show [numberOfFrames] similar', {
                  numberOfFrames: items.length - maxVisibleItems,
                })}
              </ToggleCollapse>
            </GroupingComponentListItem>
          );
        }

        return null;
      })}

      {!value && items.length > maxVisibleItems && (
        <GroupingComponentListItem>
          <ToggleCollapse
            size="sm"
            priority="link"
            icon={<IconSubtract legacySize="8px" />}
            onClick={() => setCollapsed(true)}
          >
            {tct('collapse [numberOfFrames] similar', {
              numberOfFrames: items.length - maxVisibleItems,
            })}
          </ToggleCollapse>
        </GroupingComponentListItem>
      )}
    </Fragment>
  );
}

const ToggleCollapse = styled(Button)`
  margin: ${space(0.5)} 0;
  color: ${p => p.theme.linkColor};
`;

export default GroupingComponentFrames;
