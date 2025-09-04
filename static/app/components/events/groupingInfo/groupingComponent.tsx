import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponentChildren from './groupingComponentChildren';
import GroupingComponentStacktrace from './groupingComponentStacktrace';
import {shouldInlineComponentValue} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
  maxVisibleItems?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
};

function GroupingComponent({
  component,
  showNonContributing,
  maxVisibleItems,
  onCollapsedChange,
}: Props) {
  const shouldInlineValue = shouldInlineComponentValue(component);

  const GroupingComponentListItems =
    component.id === 'stacktrace'
      ? GroupingComponentStacktrace
      : GroupingComponentChildren;

  const isStacktraceComponent = component.id === 'stacktrace';

  const totalItems = isStacktraceComponent
    ? (component.values as EventGroupComponent[])?.length || 0
    : 0;
  const maxItems = maxVisibleItems || 2;
  const hasHiddenItems = isStacktraceComponent && totalItems > maxItems;

  const [isCollapsed, setIsCollapsed] = useState(!showNonContributing);

  const handleCollapsedChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };

  return (
    <GroupingComponentWrapper isContributing={component.contributes}>
      {component.name === 'stack-trace' && hasHiddenItems && (
        <CaretButton
          size="xs"
          priority="link"
          icon={<IconChevron direction={isCollapsed ? 'down' : 'up'} legacySize="12px" />}
          onClick={() => handleCollapsedChange(!isCollapsed)}
          aria-label={isCollapsed ? t('expand stacktrace') : t('collapse stacktrace')}
        />
      )}
      <span>
        {component.name || component.id}
        {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
      </span>

      <GroupingComponentList isInline={shouldInlineValue}>
        <GroupingComponentListItems
          component={component}
          showNonContributing={showNonContributing}
          {...(isStacktraceComponent
            ? {collapsed: isCollapsed, onCollapsedChange: handleCollapsedChange}
            : {})}
        />
      </GroupingComponentList>
    </GroupingComponentWrapper>
  );
}

const GroupingComponentList = styled('ul')<{isInline: boolean}>`
  padding: 0;
  margin: 0;
  list-style: none;
  &,
  & > li {
    display: ${p => (p.isInline ? 'inline' : 'block')};
  }
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  color: ${p => (p.isContributing ? p.theme.textColor : p.theme.subText)};
`;

export const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

const CaretButton = styled(Button)`
  padding: ${space(0.25)};
  min-height: auto;
  border: none;
  background: transparent;

  &:hover {
    background: ${p => p.theme.background};
  }
`;

export default GroupingComponent;
