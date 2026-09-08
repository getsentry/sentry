import {useEffect, useRef, useState} from 'react';
import {Global} from '@emotion/react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {streamingAnimationStyles, useTextDecodeAnimation} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconSeer} from 'sentry/icons';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {SECOND} from 'sentry/utils/formatters';

const ELAPSED_TIME_TICK_INTERVAL_MS = 100;

/**
 * Returns elapsed ms between `startTime` and `endTime`.
 * While `endTime` is undefined, ticks every ELAPSED_TIME_TICK_INTERVAL_MS to keep the value live.
 */
function useElapsedTime(startTime: Date, endTime: Date | undefined): number {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (endTime) {
      return;
    }
    const id = setInterval(() => setNow(new Date()), ELAPSED_TIME_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [endTime]);

  return (endTime ?? now).getTime() - startTime.getTime();
}

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
        leadingItems={<IconSeer size="xs" animation={isActive ? 'waiting' : undefined} />}
        trailingItems={
          <Text variant="secondary" size="sm" align="right" monospace>
            {getDuration(elapsed / 1000, 1, true, false, false, SECOND)}
          </Text>
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
