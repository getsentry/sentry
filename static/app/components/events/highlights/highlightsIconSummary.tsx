import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {getContextIcon, getContextSummary} from 'sentry/components/events/contexts/utils';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {Tooltip} from 'sentry/components/tooltip';
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
          size: 'md',
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
            <Flex key={index} gap={space(1)} align="center">
              <IconWrapper>{item.icon}</IconWrapper>
              <IconDescription>
                <div>{item.title}</div>
                {item.subtitle && (
                  <IconSubtitle title={item.subtitleType}>{item.subtitle}</IconSubtitle>
                )}
              </IconDescription>
            </Flex>
          ))}
        </ScrollCarousel>
      </IconBar>
      <SectionDivider />
    </Fragment>
  ) : null;
}

const IconBar = styled('div')`
  position: relative;
  padding: ${space(0.5)} ${space(0.5)};
`;

const IconDescription = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('div')`
  flex: none;
  line-height: 1;
`;

const IconSubtitle = styled(Tooltip)`
  display: block;
  color: ${p => p.theme.subText};
`;
