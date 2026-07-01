import {useLayoutEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

interface OverflowTextProps {
  value: string;
  className?: string;
  leftTrim?: boolean;
  onTrimChange?: (trimmed: boolean) => void;
}

export function OverflowText({
  value,
  className,
  leftTrim = false,
  onTrimChange,
}: OverflowTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const trimmed = el.scrollWidth > el.clientWidth;

    onTrimChange?.(trimmed);
  }, [value, onTrimChange]);

  return (
    <TruncatedSpan ref={ref} className={className} leftTrim={leftTrim}>
      {leftTrim ? <span dir="ltr">{value}</span> : value}
    </TruncatedSpan>
  );
}

const TruncatedSpan = styled('span')<{leftTrim: boolean}>`
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: bottom;

  ${p =>
    p.leftTrim &&
    css`
      direction: rtl;
      text-align: left;
    `}
`;
