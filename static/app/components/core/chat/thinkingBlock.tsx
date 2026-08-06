import {useEffect, useState} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {SECOND} from 'sentry/utils/formatters';

/**
 * Returns elapsed ms between `startTime` and `endTime`.
 * While `endTime` is undefined, ticks every `intervalMs` to keep the value live.
 */
function useElapsedTime(
  startTime: Date,
  endTime: Date | undefined,
  intervalMs = 100
): number {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (endTime) {
      return;
    }
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [endTime, intervalMs]);

  return (endTime ?? now).getTime() - startTime.getTime();
}

interface ThinkingBlockProps {
  startTime: Date;
  title: string;
  children?: React.ReactNode;
  endTime?: Date;
}

export function ThinkingBlock({title, startTime, endTime, children}: ThinkingBlockProps) {
  const elapsed = useElapsedTime(startTime, endTime);
  const isActive = !endTime;
  const [userExpanded, setUserExpanded] = useState(false);

  const isExpanded = isActive || userExpanded;

  return (
    <Disclosure
      expanded={isExpanded}
      onExpandedChange={setUserExpanded}
      size="sm"
      variant="outline"
      flex={1}
    >
      <Disclosure.Title
        leadingItems={<IconSeer size="xs" animation={isActive ? 'waiting' : undefined} />}
        trailingItems={
          <Text variant="secondary" size="sm" align="right" monospace>
            {getDuration(elapsed / 1000, 1, true, false, false, SECOND)}
          </Text>
        }
      >
        <Text size="sm" monospace variant="muted">
          {title}
        </Text>
      </Disclosure.Title>
      {children ? <Disclosure.Content>{children}</Disclosure.Content> : null}
    </Disclosure>
  );
}
