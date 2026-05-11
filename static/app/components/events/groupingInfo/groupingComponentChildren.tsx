import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {EventGroupComponent} from 'sentry/types/event';

import {GroupingComponent} from './groupingComponent';
import {GroupingComponentListItem} from './groupingComponentFrames';
import {groupingComponentFilter} from './utils';

type Props = {
  component: EventGroupComponent;
  showNonContributing: boolean;
};

export function GroupingComponentChildren({component, showNonContributing}: Props) {
  return (
    <Fragment>
      {component.values
        .filter((value: any) => groupingComponentFilter(value, showNonContributing))
        .map((value: any, index: number) => (
          <GroupingComponentListItem
            // value.id is not a unique value
            key={typeof value === 'object' ? `${value.id}-${index}` : `${value}-${index}`}
          >
            {typeof value === 'object' ? (
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
        ))}
    </Fragment>
  );
}

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
      color: ${contributes
        ? theme.tokens.content.primary
        : theme.tokens.content.secondary};
    `}
`;
