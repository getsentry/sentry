import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

  const isCollapsible = items.length > maxVisibleItems;

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

export const GroupingComponentListItem = styled('li')<{isCollapsible?: boolean}>`
  padding: 0;
  margin: ${space(0.25)} 0 ${space(0.25)} ${space(1.5)};

  ${p =>
    p.isCollapsible &&
    css`
      border-left: 1px solid ${p.theme.innerBorder};
      margin: 0 0 -${space(0.25)} ${space(1)};
      padding-left: ${space(0.5)};
    `}
`;

export default GroupingComponentFrames;
