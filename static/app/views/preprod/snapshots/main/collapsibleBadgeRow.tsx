import {useEffect, useRef, useState} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

const ONE_ROW_HEIGHT = 20;

export function CollapsibleBadgeRow({tags}: {tags: Record<string, string>}) {
  const [expanded, setExpanded] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState(new Set<string>());
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef(new Map<string, HTMLElement>());
  const toggleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (expanded || !container) {
      return;
    }

    const calculateHidden = () => {
      const buttonWidth = toggleButtonRef.current?.offsetWidth ?? 0;
      const containerWidth = container.offsetWidth;

      const nextHidden = new Set<string>();
      badgeRefs.current.forEach((el, key) => {
        if (el.offsetTop >= ONE_ROW_HEIGHT) {
          nextHidden.add(key);
        } else if (
          buttonWidth > 0 &&
          el.offsetLeft + el.offsetWidth > containerWidth - buttonWidth
        ) {
          nextHidden.add(key);
        }
      });
      setHiddenKeys(prev =>
        prev.size === nextHidden.size && [...prev].every(k => nextHidden.has(k))
          ? prev
          : nextHidden
      );
    };

    const rafId = requestAnimationFrame(calculateHidden);
    const observer = new ResizeObserver(() => requestAnimationFrame(calculateHidden));
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [tags, expanded, hiddenKeys.size]);

  const entries = Object.entries(tags);

  return (
    <Flex
      ref={containerRef}
      align="center"
      gap="xs"
      wrap="wrap"
      overflow="hidden"
      position="relative"
      maxHeight={expanded ? undefined : `${ONE_ROW_HEIGHT}px`}
    >
      {entries.map(([key, value]) => (
        <Badge
          key={key}
          ref={(el: HTMLElement | null) => {
            if (el) {
              badgeRefs.current.set(key, el);
            } else {
              badgeRefs.current.delete(key);
            }
          }}
          variant="muted"
          style={
            !expanded && hiddenKeys.has(key) ? {visibility: 'hidden' as const} : undefined
          }
        >
          {key}={value}
        </Badge>
      ))}
      {hiddenKeys.size > 0 && !expanded && (
        <Flex
          ref={toggleButtonRef}
          align="center"
          position="absolute"
          right="0"
          bottom="0"
          height={`${ONE_ROW_HEIGHT}px`}
          background="primary"
          paddingLeft="sm"
        >
          <Button variant="link" size="xs" onClick={() => setExpanded(true)}>
            {t('+%s more tags', hiddenKeys.size)}
          </Button>
        </Flex>
      )}
    </Flex>
  );
}
