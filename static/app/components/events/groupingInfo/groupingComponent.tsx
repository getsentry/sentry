import {Activity, Fragment, useId, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Button} from '@sentry/scraps/button';

import type {EventGroupComponent} from 'sentry/types/event';

import {
  GroupingComponentFrames,
  GroupingComponentListItem,
} from './groupingComponentFrames';
import {
  getFrameGroups,
  groupingComponentFilter,
  shouldInlineComponentValue,
} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

function GroupingComponentChildren({component, showNonContributing}: Props) {
  return (
    <Fragment>
      {component.values.map((value, index) =>
        groupingComponentFilter(value, showNonContributing) ? (
          <GroupingComponentListItem
            // value.id is not a unique value
            key={
              typeof value === 'object' && value !== null
                ? `${value.id}-${index}`
                : `${value}-${index}`
            }
          >
            {typeof value === 'object' && value !== null ? (
              <GroupingComponent
                component={value}
                showNonContributing={showNonContributing}
              />
            ) : (
              <GroupingValue
                valueType={component.name || component.id}
                contributes={component.contributes}
              >
                {typeof value === 'string' || typeof value === 'number'
                  ? value
                  : JSON.stringify(value, null, 2)}
              </GroupingValue>
            )}
          </GroupingComponentListItem>
        ) : null
      )}
    </Fragment>
  );
}

function GroupingComponentStacktrace({component, showNonContributing}: Props) {
  return (
    <Fragment>
      {getFrameGroups(component, showNonContributing).map((group, index) => (
        <GroupingComponentFrames
          key={index}
          items={group.data.map((v, idx) => (
            <GroupingComponent
              key={idx}
              component={v}
              showNonContributing={showNonContributing}
            />
          ))}
          showNonContributing={showNonContributing}
        />
      ))}
    </Fragment>
  );
}

export function GroupingComponent({component, showNonContributing}: Props) {
  const contentId = useId();
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
          variant="link"
          icon={<IconChevron direction={folded ? 'right' : 'down'} legacySize="10px" />}
          onClick={() => setFolded(!folded)}
          aria-label={component.name || component.id}
          aria-expanded={!folded}
          aria-controls={contentId}
        />
      )}

      <GroupingComponentWrapper isContributing={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
        </span>

        <Activity mode={folded ? 'hidden' : 'visible'}>
          <GroupingComponentList
            id={contentId}
            isInline={shouldInlineValue}
            hasFold={canFold}
          >
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

const CollapseButtonWrapper = styled('div')`
  display: grid;
  grid-template-columns: ${p => p.theme.space.lg} minmax(auto, max-content);
  align-items: baseline;
`;

const CollapseButton = styled(Button)<{folded: boolean}>`
  grid-column: 1;
  border: none;
  opacity: ${p => (p.folded ? 1 : 0.65)};
  transition: opacity 0.2s ease;
  align-self: ${p => (p.folded ? 'center' : 'baseline')};
  color: ${p =>
    p.folded
      ? p.theme.tokens.interactive.link.accent.rest
      : p.theme.tokens.content.secondary};

  transform: ${p => (p.folded ? 'translateY(1px)' : 'translateY(2px)')};
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  grid-column: 2;
  color: ${p =>
    p.isContributing ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
`;

export const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

const GroupingValue = styled('code')<{
  valueType: string;
  contributes?: boolean;
}>`
  display: inline-block;
  margin: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs}
    ${p => p.theme.space['2xs']} 0;
  font-size: ${p => p.theme.font.size.sm};
  padding: 0 ${p => p.theme.space['2xs']};
  background: ${p => (p.contributes ? 'rgba(112, 163, 214, 0.1)' : 'transparent')};
  color: ${p =>
    p.contributes ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};

  ${({valueType, theme, contributes}) =>
    (valueType === 'function' || valueType === 'symbol') &&
    css`
      font-weight: ${contributes ? theme.font.weight.sans.medium : 'normal'};
      color: ${
        contributes ? theme.tokens.content.primary : theme.tokens.content.secondary
      };
    `}
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
