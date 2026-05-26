import {useEffect, useRef, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

// Height for 2 rows of tags (22px per row + 6px gap)
const TWO_ROW_HEIGHT = 50;

interface ToolTagsProps {
  toolNames: string[];
}

export function ToolTags({toolNames}: ToolTagsProps) {
  const [expanded, setExpanded] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef(new Map<number, HTMLElement>());
  const toggleButtonRef = useRef<HTMLDivElement>(null);

  // Calculate how many tags are hidden (overflow beyond 2 rows, or overlapped by the "+N more" button)
  useEffect(() => {
    const container = containerRef.current;
    if (expanded || !container) {
      return;
    }

    const calculateHidden = () => {
      const buttonWidth = toggleButtonRef.current?.offsetWidth ?? 0;
      const containerWidth = container.offsetWidth;

      let hidden = 0;
      tagRefs.current.forEach(tagEl => {
        if (tagEl.offsetTop >= TWO_ROW_HEIGHT) {
          hidden++;
        } else if (
          buttonWidth > 0 &&
          tagEl.offsetLeft + tagEl.offsetWidth > containerWidth - buttonWidth
        ) {
          // Tag on the last visible row is partially covered by the "+N more" button
          hidden++;
        }
      });
      setHiddenCount(hidden);
    };

    const rafId = requestAnimationFrame(calculateHidden);
    const observer = new ResizeObserver(() => requestAnimationFrame(calculateHidden));
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
    // hiddenCount is included so we re-check after the button appears (it only renders when hiddenCount > 0)
  }, [toolNames, expanded, hiddenCount]);

  return (
    <Flex
      ref={containerRef}
      align="center"
      gap="sm"
      wrap="wrap"
      overflow="hidden"
      position="relative"
      maxHeight={expanded ? '500px' : `${TWO_ROW_HEIGHT}px`}
      style={{transition: 'max-height 0.2s ease-in-out'}}
    >
      {toolNames.map((toolName, index) => (
        <Tag
          key={toolName}
          ref={el => {
            if (el) {
              tagRefs.current.set(index, el);
            } else {
              tagRefs.current.delete(index);
            }
          }}
          variant="info"
          style={{maxWidth: '100%', minWidth: 0}}
        >
          {toolName}
        </Tag>
      ))}
      {hiddenCount > 0 && !expanded && (
        <Flex
          ref={toggleButtonRef}
          align="center"
          position="absolute"
          right="0"
          bottom="4px"
          height="22px"
          background="primary"
          paddingLeft="sm"
        >
          <Button variant="link" size="xs" onClick={() => setExpanded(prev => !prev)}>
            {t('+%s more', hiddenCount)}
          </Button>
        </Flex>
      )}
      {expanded && (
        <Container flexShrink={0}>
          <Button variant="link" size="xs" onClick={() => setExpanded(prev => !prev)}>
            {t('Show less')}
          </Button>
        </Container>
      )}
    </Flex>
  );
}
