import {useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

interface TruncateProps {
  value: string;
  className?: string;
  expandDirection?: 'left' | 'right';
  expandable?: boolean;
  leftTrim?: boolean;
  maxLength?: number;
}

export function Truncate({
  value,
  className,
  maxLength = 50,
  leftTrim = false,
  expandable = true,
  expandDirection = 'right',
}: TruncateProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const onFocus = useCallback(
    () => setIsExpanded(value.length > maxLength),
    [value, maxLength]
  );

  const onBlur = useCallback(() => setIsExpanded(false), []);

  const isTruncated = value.length > maxLength;
  let shortValue: React.ReactNode = '';

  if (isTruncated) {
    const slicedValue = leftTrim
      ? value.slice(value.length - (maxLength - 4), value.length)
      : value.slice(0, maxLength - 4);

    shortValue = leftTrim ? <span>… {slicedValue}</span> : <span>{slicedValue} …</span>;
  } else {
    shortValue = value;
  }

  return (
    <Container
      as="span"
      position="relative"
      className={className}
      onMouseOver={expandable ? onFocus : undefined}
      onMouseOut={expandable ? onBlur : undefined}
      onFocus={expandable ? onFocus : undefined}
      onBlur={expandable ? onBlur : undefined}
    >
      <span>{shortValue}</span>
      {isTruncated && (
        <FullValue expanded={isExpanded} expandDirection={expandDirection}>
          {value}
        </FullValue>
      )}
    </Container>
  );
}

const FullValue = styled('span')<{
  expandDirection: 'left' | 'right';
  expanded: boolean;
}>`
  display: none;
  position: absolute;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  white-space: nowrap;
  border-radius: ${p => p.theme.space.xs};
  top: -5px;
  ${p => p.expandDirection === 'left' && 'right: -5px;'}
  ${p => p.expandDirection === 'right' && 'left: -5px;'}

  ${p =>
    p.expanded &&
    css`
      z-index: ${p.theme.zIndex.truncationFullValue};
      display: block;
    `}
`;
