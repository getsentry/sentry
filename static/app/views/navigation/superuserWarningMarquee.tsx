import {Fragment} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useShowSuperuserWarning} from 'sentry/views/navigation/useShowSuperuserWarning';

/**
 * Renders a full-width scrolling marquee warning strip when the current user
 * is an active superuser in page frame mode. Replaces the sidebar's superuser
 * overlay indicator which is too narrow for this layout.
 */
export function SuperuserWarning() {
  const showSuperuserWarning = useShowSuperuserWarning();
  const text = t('You are in superuser mode.');

  if (!showSuperuserWarning) {
    return null;
  }

  return (
    <Fragment>
      <Container height="24px" />
      <Frame
        position="fixed"
        top="0"
        right="0"
        bottom="0"
        left="0"
        border="danger"
        display="flex"
      >
        <MarqueeStrip align="baseline" overflow="hidden">
          <MarqueeText
            wrap="nowrap"
            monospace
            bold
            uppercase
            style={{'--len': text.length + 1} as React.CSSProperties}
          >
            {Array.from({length: 8}, () => text).join(' ')}
          </MarqueeText>
        </MarqueeStrip>
      </Frame>
    </Fragment>
  );
}

const scrollLeft = keyframes`
  from { transform: translateY(1px) translateX(0); }
  to { transform: translateY(1px) translateX(calc(var(--len, 1) * -1ch)); }
`;

const Frame = styled(Container)`
  /* Allows clicks to pass through to content */
  pointer-events: none;
  /* Ensures it stays on top of all content */
  z-index: 9999;
  border-width: ${p => p.theme.border.xl};
`;

const MarqueeStrip = styled(Flex)`
  background: ${p => p.theme.tokens.background.danger.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  height: 24px;
  width: 100%;
  flex-shrink: 0;
`;

const MarqueeText = styled(Text)`
  display: inline-block;
  animation: ${scrollLeft} 24s linear infinite;
`;
