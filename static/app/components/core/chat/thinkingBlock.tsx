import {useEffect, useRef, useState} from 'react';
import {Global} from '@emotion/react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {streamingAnimationStyles, useTextDecodeAnimation} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconSeer} from 'sentry/icons';
import {formatElapsedSeconds, useElapsedTime} from 'sentry/utils/duration/useElapsedTime';

/**
 * A 1.5ch-wide, layout-stable ellipsis that cycles ".", "..", "..." to signal
 * ongoing work. Width is fixed; the dots are absolutely positioned across it
 * in even thirds so they fit the reserved space and never shift layout as the
 * count changes. Decorative — hidden from AT.
 */
const ELLIPSIS_TICK_INTERVAL_MS = 400;

function AnimatedEllipsis() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setCount(c => (c % 3) + 1), ELLIPSIS_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '1.5ch',
        height: '1em',
      }}
    >
      {Array.from({length: count}, (_, i) => (
        <span key={i} style={{position: 'absolute', left: `${(i * 100) / 3}%`, top: 0}}>
          .
        </span>
      ))}
    </span>
  );
}

interface ThinkingBlockProps {
  startTime: Date;
  title: string;
  children?: React.ReactNode;
  endTime?: Date;
}

export function ThinkingBlock({title, startTime, endTime, children}: ThinkingBlockProps) {
  const {t} = useTranslation();
  const elapsed = useElapsedTime(startTime, endTime);
  const isActive = !endTime;
  // ponytail: null = no user interaction, falls through to isActive default
  const [override, setOverride] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isActive) {
      // oxlint-disable-next-line react/set-state-in-effect
      setOverride(null);
    }
  }, [isActive]);

  const titleRef = useRef<HTMLSpanElement>(null);
  const baseTitle = title.replace(/[.…\s]+$/u, '');
  useTextDecodeAnimation(titleRef, baseTitle);

  const isExpanded = override ?? isActive;
  const summaryTitle = t('See thinking and tool calls');

  return (
    <Disclosure
      expanded={isExpanded}
      onExpandedChange={setOverride}
      size="sm"
      variant="outline"
      flex={1}
      minWidth={0}
    >
      <Global styles={streamingAnimationStyles} />
      <Disclosure.Title
        leadingItems={<IconSeer size="xs" animation={isActive ? 'loading' : undefined} />}
        trailingItems={
          elapsed === null ? null : (
            <Text variant="secondary" size="sm" align="right" monospace>
              {formatElapsedSeconds(elapsed)}
            </Text>
          )
        }
      >
        <Text size="sm" monospace variant="muted" ellipsis>
          {isActive ? (
            <span key={baseTitle} ref={titleRef}>
              {baseTitle}
            </span>
          ) : (
            summaryTitle
          )}
          {isActive ? <AnimatedEllipsis /> : null}
        </Text>
      </Disclosure.Title>
      {children ? <Disclosure.Content>{children}</Disclosure.Content> : null}
    </Disclosure>
  );
}
