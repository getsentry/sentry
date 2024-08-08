import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {getContextIcon, getContextSummary} from 'sentry/components/events/contexts/utils';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/interimSection';

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

  return [].length ? (
    <Fragment>
      <IconBar>
        {items.map((item, index) => (
          <IconSummary key={index}>
            <IconWrapper>{item.icon}</IconWrapper>
            <IconTitle>{item.title}</IconTitle>
            <IconSubtitle>{item.subtitle}</IconSubtitle>
          </IconSummary>
        ))}
      </IconBar>
      <SectionDivider />
    </Fragment>
  ) : null;
}

const IconBar = styled('div')`
  display: flex;
  gap: ${space(4)};
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  margin: ${space(2)} ${space(0.75)};
  position: relative;
  &:after {
    position: sticky;
    height: 100%;
    padding: ${space(2)};
    content: '';
    inset: 0;
    left: 90%;
    background-image: linear-gradient(90deg, transparent, ${p => p.theme.background});
  }
`;

const IconSummary = styled('div')`
  flex: none;
  display: grid;
  grid-template: 1fr 1fr / auto 1fr;
  grid-column-gap: ${space(1)};
  grid-row-gap: ${space(0.5)};
`;

const IconWrapper = styled('div')`
  grid-area: 1 / 1 / 3 / 2;
  align-self: center;
`;

const IconTitle = styled('div')`
  grid-area: 1 / 2 / 2 / 3;
  align-self: self-end;
  line-height: 1;
`;

const IconSubtitle = styled('div')`
  grid-area: 2 / 2 / 3 / 3;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
  align-self: self-start;
`;
