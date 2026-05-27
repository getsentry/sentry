import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

const ONE_ROW_HEIGHT = 20;

export function CollapsibleBadgeRow({
  tags,
  onTagClick,
  activeTagFilters,
}: {
  tags: Record<string, string>;
  activeTagFilters?: Record<string, string>;
  onTagClick?: (key: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowCount, setOverflowCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (expanded || !container) {
      return;
    }

    const calculate = () => {
      const buttonEl = toggleRef.current;
      const buttonWidth = buttonEl?.offsetWidth ?? 0;
      const containerWidth = container.offsetWidth;

      let count = 0;
      for (const child of container.children) {
        if (child === buttonEl) {
          continue;
        }
        const el = child as HTMLElement;
        if (
          el.offsetTop >= ONE_ROW_HEIGHT ||
          (buttonWidth > 0 &&
            el.offsetLeft + el.offsetWidth > containerWidth - buttonWidth)
        ) {
          count++;
        }
      }
      setOverflowCount(prev => (prev === count ? prev : count));
    };

    const rafId = requestAnimationFrame(calculate);
    const observer = new ResizeObserver(() => requestAnimationFrame(calculate));
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [tags, expanded, overflowCount]);

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
      {entries.map(([key, value]) =>
        onTagClick ? (
          <ClickableBadge
            key={key}
            type="button"
            isActive={activeTagFilters?.[key] === value}
            onClick={e => {
              e.stopPropagation();
              onTagClick(key, value);
            }}
          >
            {key}={value}
          </ClickableBadge>
        ) : (
          <Badge key={key} variant="muted">
            {key}={value}
          </Badge>
        )
      )}
      {overflowCount > 0 && !expanded && (
        <Flex
          ref={toggleRef}
          align="center"
          position="absolute"
          right="0"
          bottom="0"
          height={`${ONE_ROW_HEIGHT}px`}
          background="primary"
          paddingLeft="sm"
        >
          <Button
            variant="link"
            size="xs"
            onClick={e => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            {t('+%s more tags', overflowCount)}
          </Button>
        </Flex>
      )}
    </Flex>
  );
}

const ClickableBadge = styled('button')<{isActive: boolean}>`
  display: inline-flex;
  align-items: center;
  height: ${ONE_ROW_HEIGHT}px;
  padding: 0 ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid
    ${p =>
      p.isActive ? p.theme.tokens.border.accent.vibrant : p.theme.tokens.border.primary};
  background: ${p =>
    p.isActive ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};
  font-size: ${p => p.theme.font.size.xs};
  color: ${p =>
    p.isActive ? p.theme.tokens.content.accent : p.theme.tokens.content.secondary};
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
    color: ${p => p.theme.tokens.content.primary};
  }
`;
