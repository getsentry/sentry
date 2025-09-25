import {useCallback, useEffect, useState} from 'react';
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
};

function GroupingComponent({component, showNonContributing}: Props) {
  const shouldInlineValue = shouldInlineComponentValue(component);

  const GroupingComponentListItems =
    component.id === 'stacktrace'
      ? GroupingComponentStacktrace
      : GroupingComponentChildren;

  const [folded, setFolded] = useState(false);
  const canFold = component.values.length > 1;

  return (
    <GroupingComponentWrapper isContributing={component.contributes}>
      <span>
        {canFold && (
          <CollapseButton
            size="xs"
            priority="link"
            icon={<IconChevron direction={folded ? 'right' : 'down'} legacySize="12px" />}
            onClick={() => setFolded(!folded)}
            aria-label={folded ? t('expand stacktrace') : t('collapse stacktrace')}
          />
        )}
        {component.name || component.id}

        {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
      </span>

      {!folded && (
        <GroupingComponentList isInline={shouldInlineValue}>
          <GroupingComponentListItems
            component={component}
            showNonContributing={showNonContributing}
          />
        </GroupingComponentList>
      )}
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
