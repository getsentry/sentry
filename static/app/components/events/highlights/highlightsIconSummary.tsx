import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {getContextIcon, getContextSummary} from 'sentry/components/events/contexts/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';

interface HighlightIconSummaryProps {
  event: Event;
}

export function HighlightIconSummary({event}: HighlightIconSummaryProps) {
  // For now, highlight icons are only interpretted from context. We should extend this to tags
  // eventually, but for now, it'll match the previous expectations.
  const items = getOrderedContextItems(event)
    .map(({alias, type, value}) => ({
      ...getContextSummary({type, value}),
      icon: getContextIcon({
        alias,
        type,
        value,
        contextIconProps: {
          size: 'xl',
        },
      }),
    }))
    .filter(item => item.icon !== null);

  return (
    <IconBar>
      {items.map((item, index) => (
        <Tooltip
          key={index}
          title={
            <Fragment>
              <b>{item.title}</b>
              <div>{item.subtitle}</div>
            </Fragment>
          }
        >
          {item.icon}
        </Tooltip>
      ))}
    </IconBar>
  );
}

const IconBar = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
