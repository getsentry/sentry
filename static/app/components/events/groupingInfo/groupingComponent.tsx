import {useEffect, useRef, useState} from 'react';
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
  maxVisibleItems = 2,
  onCollapsedChange,
}: Props) {
  const shouldInlineValue = shouldInlineComponentValue(component);

  const GroupingComponentListItems =
    component.id === 'stacktrace'
      ? GroupingComponentStacktrace
      : GroupingComponentChildren;
  const isStacktrace = component.id === 'stacktrace';
  const stacktraceValues = isStacktrace
    ? (component.values as EventGroupComponent[])
    : [];
  const hasCollapsibleItems = isStacktrace && stacktraceValues.length > maxVisibleItems;

  const [isCollapsed, setIsCollapsed] = useState(!showNonContributing);
  const prevTabState = useRef(showNonContributing);

  useEffect(() => {
    if (isStacktrace && prevTabState.current !== showNonContributing) {
      const shouldCollapse = !showNonContributing;
      setIsCollapsed(shouldCollapse);
      onCollapsedChange?.(shouldCollapse);
      prevTabState.current = showNonContributing;
    }
  }, [showNonContributing, isStacktrace, onCollapsedChange]);

  const toggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  const stacktraceProps = isStacktrace
    ? {collapsed: isCollapsed, onCollapsedChange: toggleCollapsed}
    : {};

  return (
    <GroupingComponentWrapper isContributing={component.contributes}>
      <span>
        {component.name || component.id}
        {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
        {component.name === 'stack-trace' && hasCollapsibleItems && (
          <CaretButton
            size="xs"
            priority="link"
            icon={
              <IconChevron direction={isCollapsed ? 'down' : 'up'} legacySize="12px" />
            }
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? t('expand stacktrace') : t('collapse stacktrace')}
          />
        )}
      </span>

      <GroupingComponentList isInline={shouldInlineValue}>
        <GroupingComponentListItems
          component={component}
          showNonContributing={showNonContributing}
          {...stacktraceProps}
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
  display: inline-block;
  padding: ${p => p.theme.space.xs};
  min-height: auto;
  border: none;
  background: transparent;
  margin-left: ${p => p.theme.space.sm};
  vertical-align: middle;

  &:hover {
    background: ${p => p.theme.background};
  }
`;

export default GroupingComponent;
