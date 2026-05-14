import {Fragment, useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {Client} from 'sentry/api';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';
import {SUPERUSER_MARQUEE_HEIGHT} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const POLICY_URL =
  'https://www.notion.so/sentry/Sentry-Rules-for-Handling-Customer-Data-9612532c37e14eeb943a6a584abbac99';

const SUPERUSER_MESSAGE = 'You are in superuser mode / Hover to exit or learn more';
const SUPERUSER_SEPARATOR = ' ///// ';
const WARNING_MESSAGE = (
  <Fragment>
    Please refer to Sentry's{' '}
    <a href={POLICY_URL} target="_none">
      rules for handling customer data
    </a>
    . Misuse of superuser will result in an unpleasant coffee chat with Legal, Security,
    and HR.
  </Fragment>
);

export function shouldExcludeOrg(organization?: Organization | null) {
  return organization?.slug === 'demo';
}

function handleExitSuperuser(api: Client) {
  api
    .requestPromise('/staff-auth/', {
      method: 'DELETE',
    })
    .then(() => window.location.reload());
}

function ExitSuperuserButton() {
  const theme = useTheme();
  const api = useApi({persistInFlight: true});
  return (
    <Button
      style={{
        top: theme.space.xs,
        bottom: theme.space.sm,
      }}
      size="sm"
      variant="primary"
      onClick={() => {
        handleExitSuperuser(api);
      }}
    >
      Exit Superuser Mode
    </Button>
  );
}

type Props = {
  className?: string;
  organization?: Organization;
};

export function SuperuserWarning({organization, className}: Props) {
  const hasPageFrame = useHasPageFrameFeature();
  const isExcludedOrg = shouldExcludeOrg(organization);

  const stripRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [marqueeCount, setMarqueeCount] = useState(8);

  useResizeObserver({
    ref: stripRef,
    onResize() {
      const strip = stripRef.current;
      const text = textRef.current;
      if (!strip || !text) {
        return;
      }
      const stripWidth = strip.clientWidth;
      if (!stripWidth || !text.offsetWidth) {
        return;
      }
      setMarqueeCount(currentCount => {
        const repWidth = text.offsetWidth / currentCount;
        return repWidth ? Math.ceil(stripWidth / repWidth) + 2 : currentCount;
      });
    },
  });

  useEffect(() => {
    if (!isExcludedOrg) {
      AlertStore.addAlert({
        id: 'superuser-warning',
        message: (
          <Fragment>
            {hasPageFrame ? null : SUPERUSER_MESSAGE} {WARNING_MESSAGE}
          </Fragment>
        ),
        variant: 'danger',
        opaque: true,
        neverExpire: true,
        noDuplicates: true,
      });
    }
  }, [hasPageFrame, isExcludedOrg]);

  if (isExcludedOrg) {
    return null;
  }

  if (hasPageFrame) {
    return (
      <Fragment>
        <Container height={`${SUPERUSER_MARQUEE_HEIGHT}px`} />
        <Frame
          position="fixed"
          top="0"
          right="0"
          bottom="0"
          left="0"
          border="danger"
          display="flex"
        >
          <Tooltip
            isHoverable
            position="bottom-start"
            containerDisplayMode="block"
            title={
              <TooltipContent>
                <Content>{WARNING_MESSAGE}</Content>
                <ExitSuperuserButton />
              </TooltipContent>
            }
          >
            <MarqueeStrip ref={stripRef} align="baseline" overflow="hidden">
              <MarqueeText
                ref={textRef}
                wrap="nowrap"
                monospace
                bold
                uppercase
                style={
                  {
                    '--len': `${SUPERUSER_MESSAGE}${SUPERUSER_SEPARATOR}`.length,
                  } as React.CSSProperties
                }
              >
                {`${SUPERUSER_MESSAGE}${SUPERUSER_SEPARATOR}`.repeat(marqueeCount)}
              </MarqueeText>
            </MarqueeStrip>
          </Tooltip>
        </Frame>
      </Fragment>
    );
  }

  return (
    <StyledBadge variant="warning" className={className}>
      <Tooltip
        isHoverable
        title={
          <TooltipContent>
            <Content>{WARNING_MESSAGE}</Content>
            <ExitSuperuserButton />
          </TooltipContent>
        }
      >
        Superuser
      </Tooltip>
    </StyledBadge>
  );
}

const StyledBadge = styled(Badge)`
  color: ${p => p.theme.tokens.content.onVibrant.light};
  background: ${p => p.theme.tokens.background.danger.vibrant};
`;

const TooltipContent = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space['2xs']};
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  text-align: left;
`;

const Content = styled('p')`
  margin: 0;
`;

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
  /* Keep the marquee strip pinned to the top so the tooltip anchors there too */
  align-items: flex-start;
`;

const MarqueeStrip = styled(Flex)`
  background: ${p => p.theme.tokens.background.danger.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  height: ${SUPERUSER_MARQUEE_HEIGHT}px;
  width: 100%;
  flex-shrink: 0;
  /* Re-enable pointer events so the tooltip is hoverable */
  pointer-events: auto;
  cursor: help;
`;

const MarqueeText = styled(Text)`
  display: inline-block;
  animation: ${scrollLeft} 24s linear infinite;
  color: ${p => p.theme.tokens.content.onVibrant.light};
`;
