import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventGroupComponent} from 'sentry/types/event';

import GroupingComponentChildren from './groupingComponentChildren';
import GroupingComponentStacktrace from './groupingComponentStacktrace';
import {getFrameGroups, shouldInlineComponentValue} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

function GroupingComponent({component, showNonContributing}: Props) {
  const maxVisibleItems = 2;
  const shouldInlineValue = shouldInlineComponentValue(component);

  const GroupingComponentListItems =
    component.id === 'stacktrace'
      ? GroupingComponentStacktrace
      : GroupingComponentChildren;
  const frameGroups = useMemo(
    () => getFrameGroups(component, showNonContributing),
    [component, showNonContributing]
  );

  const isStacktraceCollapsible =
    component.id === 'stacktrace' &&
    frameGroups.some(group => group.data.length > maxVisibleItems);

  const [isCollapsed, setIsCollapsed] = useState(!showNonContributing);
  const prevTabState = useRef(showNonContributing);

  useEffect(() => {
    if (component.id === 'stacktrace' && prevTabState.current !== showNonContributing) {
      const shouldCollapse = !showNonContributing;
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setIsCollapsed(shouldCollapse);
      prevTabState.current = showNonContributing;
    }
  }, [showNonContributing, component.id]);

  const handleCollapsedChange = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);

  const stacktraceProps =
    component.id === 'stacktrace'
      ? {
          collapsed: isCollapsed,
          onCollapsedChange: handleCollapsedChange,
        }
      : {};

  return (
    <GroupingComponentWrapper isContributing={component.contributes}>
      <span>
        {component.name || component.id}
        {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
        {component.id === 'stacktrace' && isStacktraceCollapsible && (
          <CollapseButton
            size="xs"
            priority="link"
            icon={
              <IconChevron direction={isCollapsed ? 'down' : 'up'} legacySize="12px" />
            }
            onClick={() => handleCollapsedChange(!isCollapsed)}
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

const CollapseButton = styled(Button)`
  display: inline-block;
  padding: ${p => p.theme.space.xs};
  min-height: auto;
  border: none;
  margin-left: ${p => p.theme.space.sm};
  vertical-align: middle;

  &:hover {
    background: ${p => p.theme.background};
  }
`;

export default GroupingComponent;
