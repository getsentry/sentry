import {Activity, useState} from 'react';
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
};

function GroupingComponent({component, showNonContributing}: Props) {
  const shouldInlineValue = shouldInlineComponentValue(component);
  const GroupingComponentListItems =
    component.id === 'stacktrace'
      ? GroupingComponentStacktrace
      : GroupingComponentChildren;

  const [folded, setFolded] = useState(false);
  const canFold = !shouldInlineValue;

  return (
    <CollapseButtonWrapper>
      {canFold && (
        <CollapseButton
          folded={folded}
          className="collapse-button"
          priority="link"
          icon={<IconChevron direction={folded ? 'right' : 'down'} legacySize="10px" />}
          onClick={() => setFolded(!folded)}
          aria-label={folded ? t('expand') : t('collapse')}
        />
      )}

      <GroupingComponentWrapper isContributing={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
        </span>

        <Activity mode={folded ? 'hidden' : 'visible'}>
          <GroupingComponentList isInline={shouldInlineValue} hasFold={canFold}>
            <GroupingComponentListItems
              component={component}
              showNonContributing={showNonContributing}
            />
          </GroupingComponentList>
        </Activity>
      </GroupingComponentWrapper>
    </CollapseButtonWrapper>
  );
}

const CHEVRON_COL = space(1.5);

const CollapseButtonWrapper = styled('div')`
  display: grid;
  grid-template-columns: ${CHEVRON_COL} minmax(auto, max-content);
  align-items: baseline;
`;

const CollapseButton = styled(Button)<{folded: boolean}>`
  grid-column: 1;
  border: none;
  opacity: ${p => (p.folded ? 1 : 0.25)};
  transition: opacity 0.2s ease;
  align-self: ${p => (p.folded ? 'center' : 'baseline')};
  color: ${p => (p.folded ? p.theme.linkColor : p.theme.subText)};

  transform: ${p => (p.folded ? 'translateY(1px)' : 'translateY(2px)')};
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  grid-column: 2;
  color: ${p => (p.isContributing ? p.theme.tokens.content.primary : p.theme.subText)};
`;

export const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

const GroupingComponentList = styled('ul')<{hasFold: boolean; isInline: boolean}>`
  list-style: none;
  padding-left: 0;
  padding-right: 0;
  margin-left: -6px;
  margin-right: 0;

  &,
  & > li {
    display: ${p => (p.isInline ? 'inline' : 'block')};
  }

  ${p =>
    p.hasFold &&
    css`
      border-left: 1px solid ${p.theme.tokens.border.secondary};
    `}
`;

export default GroupingComponent;
