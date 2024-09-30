import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {getContextIcon, getContextSummary} from 'sentry/components/events/contexts/utils';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

interface HighlightsIconSummaryProps {
  event: Event;
}

export function HighlightsIconSummary({event}: HighlightsIconSummaryProps) {
  // Hide device for non-native platforms since it's mostly duplicate of the client_os or os context
  const shouldDisplayDevice =
    isMobilePlatform(event.platform) || isNativePlatform(event.platform);
  // For now, highlight icons are only interpretted from context. We should extend this to tags
  // eventually, but for now, it'll match the previous expectations.
  const items = getOrderedContextItems(event)
    .map(({alias, type, value}) => ({
      ...getContextSummary({type, value}),
      alias,
      icon: getContextIcon({
        alias,
        type,
        value,
        contextIconProps: {
          size: 'xl',
        },
      }),
    }))
    .filter(item => {
      const hasData = item.icon !== null && Boolean(item.title || item.subtitle);
      if (item.alias === 'device') {
        return hasData && shouldDisplayDevice;
      }

      return hasData;
    });

  return items.length ? (
    <Fragment>
      <IconBar>
        <ScrollCarousel gap={4}>
          {items.map((item, index) => (
            <IconSummary key={index}>
              <IconWrapper>{item.icon}</IconWrapper>
              <IconTitle>{item.title}</IconTitle>
              <IconSubtitle>{item.subtitle}</IconSubtitle>
            </IconSummary>
          ))}
        </ScrollCarousel>
      </IconBar>
      <SectionDivider />
    </Fragment>
  ) : null;
}

const IconBar = styled('div')`
  position: relative;
  padding: ${space(2)} ${space(0.5)};
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
