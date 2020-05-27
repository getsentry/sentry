import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {EventGroupComponent} from 'app/types';

import {shouldInlineComponentValue} from './utils';
import GroupingComponentStacktrace from './groupingComponentStacktrace';
import GroupingComponentChildren from './groupingComponentChildren';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

const GroupingComponent = ({component, showNonContributing}: Props) => {
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
};

const GroupingComponentList = styled('ul')<{isInline: boolean}>`
  padding: 0;
  margin: 0;
  list-style: none;
  &,
  & > li {
    display: ${p => (p.isInline ? 'inline' : 'block')};
  }
`;

export const GroupingComponentListItem = styled('li')<{isCollapsable?: boolean}>`
  padding: 0;
  margin: ${space(0.25)} 0 ${space(0.25)} ${space(1.5)};

  ${p =>
    p.isCollapsable &&
    `
    border-left: 1px solid ${p.theme.borderLight};
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
  color: #4e3fb4;

  ${({valueType}) =>
    (valueType === 'function' || valueType === 'symbol') &&
    `
    font-weight: bold;
    color: #2c58a8;
  `}
`;

const GroupingComponentWrapper = styled('div')<{isContributing: boolean}>`
  color: ${p => (p.isContributing ? null : p.theme.gray400)};

  ${GroupingValue}, button {
    opacity: ${p => (p.isContributing ? 1 : 0.6)};
  }
`;

const GroupingHint = styled('small')`
  font-size: 0.8em;
`;

export default GroupingComponent;
