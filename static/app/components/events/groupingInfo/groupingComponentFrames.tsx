import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface GroupingComponentFramesProps {
  initialCollapsed: boolean;
  items: React.ReactNode[];
  maxVisibleItems?: number;
}

function GroupingComponentFrames({
  items,
  maxVisibleItems = 2,
  initialCollapsed,
}: GroupingComponentFramesProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const isCollapsible = items.length > maxVisibleItems;

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setCollapsed(initialCollapsed);
  }, [initialCollapsed]);

  return (
    <Fragment>
      {items.map((item, index) => {
        if (!collapsed || index < maxVisibleItems) {
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

      {!collapsed && items.length > maxVisibleItems && (
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
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
`;

export const GroupingComponentListItem = styled('li')<{isCollapsible?: boolean}>`
  padding: 0;
  margin: ${space(0.25)} 0 ${space(0.25)} ${space(1.5)};
`;

export default GroupingComponentFrames;
