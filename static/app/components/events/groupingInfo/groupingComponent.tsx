import styled from '@emotion/styled';

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

  return (
    <GroupingComponentWrapper isContributing={component.contributes}>
      <span>
        {component.name || component.id}
        {component.hint && <GroupingHint>{` (${component.hint})`}</GroupingHint>}
      </span>

      <GroupingComponentList isInline={shouldInlineValue}>
        <GroupingComponentListItems
          component={component}
          showNonContributing={showNonContributing}
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
    `
    border-left: 1px solid ${p.theme.innerBorder};
    margin: 0 0 -${space(0.25)} ${space(1)};
    padding-left: ${space(0.5)};
  `}
`;

export const GroupingValue = styled('code')<{valueType: string}>`
  display: inline-block;
  margin: ${space(0.25)} ${space(0.5)} ${space(0.25)} 0;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: 0 ${space(0.25)};
  background: rgba(112, 163, 214, 0.1);
  color: ${p => p.theme.textColor};

  ${({valueType}) =>
    (valueType === 'function' || valueType === 'symbol') &&
    `
    font-weight: ${(p: any) => p.theme.fontWeightBold};
    color: ${(p: any) => p.theme.textColor};
  `}
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  color: ${p => (p.isContributing ? null : p.theme.textColor)};

  ${GroupingValue}, button {
    opacity: 1;
  }
`;

const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

export default GroupingComponent;
