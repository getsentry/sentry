import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {tct} from 'sentry/locale';

interface GroupingComponentFramesProps {
  items: React.ReactNode[];
  showNonContributing: boolean;
}

export function GroupingComponentFrames({
  items,
  showNonContributing,
}: GroupingComponentFramesProps) {
  const [collapsed, setCollapsed] = useState(!showNonContributing);
  const [previousShowNonContributing, setPreviousShowNonContributing] =
    useState(showNonContributing);
  const isCollapsible = items.length > 2;

  // Reset the frame limit without remounting nested disclosures.
  if (previousShowNonContributing !== showNonContributing) {
    setPreviousShowNonContributing(showNonContributing);
    setCollapsed(!showNonContributing);
  }

  const visibleItems = collapsed ? items.slice(0, 2) : items;

  return (
    <Fragment>
      {visibleItems.map((item, index) => (
        <GroupingComponentListItem isCollapsible={isCollapsible} key={index}>
          {item}
        </GroupingComponentListItem>
      ))}

      {isCollapsible && (
        <GroupingComponentListItem key="toggle">
          <ToggleCollapse
            size="sm"
            variant="link"
            icon={
              collapsed ? <IconAdd legacySize="8px" /> : <IconSubtract legacySize="8px" />
            }
            onClick={() => setCollapsed(previous => !previous)}
            aria-expanded={!collapsed}
          >
            {collapsed
              ? tct('show [numberOfFrames] similar', {numberOfFrames: items.length - 2})
              : tct('collapse [numberOfFrames] similar', {
                  numberOfFrames: items.length - 2,
                })}
          </ToggleCollapse>
        </GroupingComponentListItem>
      )}
    </Fragment>
  );
}

const ToggleCollapse = styled(Button)`
  margin: ${p => p.theme.space.xs} 0;
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
`;

export const GroupingComponentListItem = styled('li')<{isCollapsible?: boolean}>`
  padding: 0;
  margin: ${p => p.theme.space['2xs']} 0 ${p => p.theme.space['2xs']}
    ${p => p.theme.space.lg};
`;
