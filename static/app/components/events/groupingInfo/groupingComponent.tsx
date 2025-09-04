import {useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  const GroupingComponentListItems = isStacktrace
    ? GroupingComponentStacktrace
    : GroupingComponentChildren;
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

export const GroupingValue = styled('code')<{
  valueType: string;
  contributes?: boolean;
}>`
  display: inline-block;
  margin: ${space(0.25)} ${space(0.5)} ${space(0.25)} 0;
  font-size: ${p => p.theme.fontSize.sm};
  padding: 0 ${space(0.25)};
  background: ${p => (p.contributes ? 'rgba(112, 163, 214, 0.1)' : 'transparent')};
  color: ${p => (p.contributes ? p.theme.textColor : p.theme.subText)};

  ${({valueType, theme, contributes}) =>
    (valueType === 'function' || valueType === 'symbol') &&
    css`
      font-weight: ${contributes ? theme.fontWeight.bold : 'normal'};
      color: ${contributes ? theme.textColor : theme.subText};
    `}
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  color: ${p => (p.isContributing ? p.theme.textColor : p.theme.subText)};

  ${GroupingValue}, button {
    opacity: 1;
  }
`;

export const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

const CaretButton = styled(Button)`
  display: inline-block;
  padding: ${space(0.25)};
  min-height: auto;
  border: none;
  background: transparent;
  margin-left: ${space(0.5)};
  vertical-align: middle;

  &:hover {
    background: ${p => p.theme.background};
  }
`;

export default GroupingComponent;
