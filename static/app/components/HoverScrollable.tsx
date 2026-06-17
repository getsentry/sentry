import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

interface HoverScrollableProps {
  value: string;
  className?: string;
  leftTrim?: boolean;
  maxLength?: number;
  minLength?: number;
  trimRegex?: RegExp;
}

export function HoverScrollable({
  value,
  trimRegex,
  className,
  minLength = 15,
  maxLength = 50,
  leftTrim = false,
}: HoverScrollableProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [translateX, setTranslateX] = useState(0);

  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);

  const isTruncated = value.length > maxLength;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    const overflow = content.scrollWidth - container.clientWidth;

    if (overflow <= 0) {
      setTranslateX(0);
      return;
    }

    const rect = container.getBoundingClientRect();

    const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setTranslateX(-overflow * progress);
  }, []);

  let shortValue: React.ReactNode;

  if (isTruncated) {
    const slicedValue = leftTrim
      ? value.slice(value.length - (maxLength - 4))
      : value.slice(0, maxLength - 4);

    if (trimRegex && leftTrim) {
      const valueIndex = slicedValue.search(trimRegex);

      shortValue = (
        <span>
          …{' '}
          {valueIndex > 0 && valueIndex <= maxLength - minLength
            ? slicedValue.slice(valueIndex)
            : slicedValue}
        </span>
      );
    } else if (trimRegex && !leftTrim) {
      const matches = slicedValue.match(trimRegex);

      let lastIndex = matches
        ? slicedValue.lastIndexOf(matches[matches.length - 1]!) + 1
        : slicedValue.length;

      if (lastIndex <= minLength) {
        lastIndex = slicedValue.length;
      }

      shortValue = <span>{slicedValue.slice(0, lastIndex)} …</span>;
    } else if (leftTrim) {
      shortValue = <span>… {slicedValue}</span>;
    } else {
      shortValue = <span>{slicedValue} …</span>;
    }
  } else {
    shortValue = value;
  }

  if (!isTruncated) {
    return <span className={className}>{value}</span>;
  }

  return (
    <Container
      as="span"
      className={className}
      display="inline-block"
      maxWidth="100%"
      overflow="hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setTranslateX(0);
      }}
    >
      {isHovered ? (
        <SlidingContainer ref={containerRef} onMouseMove={handleMouseMove}>
          <SlidingText
            ref={contentRef}
            style={{
              transform: `translateX(${translateX}px)`,
            }}
          >
            {value}
          </SlidingText>
        </SlidingContainer>
      ) : (
        shortValue
      )}
    </Container>
  );
}

const SlidingContainer = styled('span')`
  display: inline-block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
`;

const SlidingText = styled('span')`
  display: inline-block;
  white-space: nowrap;
  will-change: transform;
`;
