import {useCallback, useEffect, useState} from 'react';
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
  const canFold = component.values.length > 1;

  return (
    <Test>
      {canFold && (
        <CollapseButton
          folded={folded}
          className="collapse-button"
          size="xs"
          priority="link"
          icon={<IconChevron direction={folded ? 'right' : 'down'} legacySize="12px" />}
          onClick={() => setFolded(!folded)}
          aria-label={folded ? t('expand stacktrace') : t('collapse stacktrace')}
        />
      )}

      {/* everything textual goes in column 2 */}
      <GroupingComponentWrapper isContributing={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
        </span>

        {!folded && (
          <GroupingComponentList isInline={shouldInlineValue} hasFold={canFold}>
            <GroupingComponentListItems
              component={component}
              showNonContributing={showNonContributing}
            />
          </GroupingComponentList>
        )}
      </GroupingComponentWrapper>
    </Test>
  );
}

const CHEVRON_COL = '12px'; // narrower chevron column

const Test = styled('div')`
  display: grid;
  grid-template-columns: ${CHEVRON_COL} minmax(auto, max-content);
  align-items: baseline;
`;

// keep alignment; make the button visually smaller and tighter
const CollapseButton = styled(Button)<{folded: boolean}>`
  grid-column: 1;
  min-height: auto;
  border: none;
  padding: 0;

  margin-left: -5px;
  opacity: ${p => (p.folded ? 1 : 0)};
  align-self: ${p => (p.folded ? 'center' : 'top')};
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

// text wrapper column
const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  grid-column: 2;
  color: ${p => (p.isContributing ? p.theme.textColor : p.theme.subText)};
  font-size: 13px;
  line-height: 1.3;
  max-width: max-content; /* shrink-wrap to text width instead of stretching full width */
`;

export const GroupingHint = styled('small')`
  font-size: 0.85em;
  opacity: 0.9;
`;

const GroupingComponentList = styled('ul')<{hasFold: boolean; isInline: boolean}>`
  padding: 0;
  margin: 0;
  list-style: none;

  &,
  & > li {
    display: ${p => (p.isInline ? 'inline' : 'block')};
  }

  ${p =>
    p.hasFold &&
    css`
      border-left: 1px solid ${p.theme.innerBorder};
    `}
`;

export default GroupingComponent;
