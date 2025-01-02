import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface TruncateProps {
  value: string;
  className?: string;
  expandDirection?: 'left' | 'right';
  expandable?: boolean;
  leftTrim?: boolean;
  maxLength?: number;
  minLength?: number;
  trimRegex?: RegExp;
}

function Truncate({
  value,
  trimRegex,
  className,
  minLength = 15,
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

    // Try to trim to values from the regex
    if (trimRegex && leftTrim) {
      const valueIndex = slicedValue.search(trimRegex);
      shortValue = (
        <span>
          …{' '}
          {valueIndex > 0 && valueIndex <= maxLength - minLength
            ? slicedValue.slice(slicedValue.search(trimRegex), slicedValue.length)
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

  return (
    <Wrapper
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
    </Wrapper>
  );
}

const Wrapper = styled('span')`
  position: relative;
`;

export const FullValue = styled('span')<{
  expandDirection: 'left' | 'right';
  expanded: boolean;
}>`
  display: none;
  position: absolute;
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  white-space: nowrap;
  border-radius: ${space(0.5)};
  top: -5px;
  ${p => p.expandDirection === 'left' && 'right: -5px;'}
  ${p => p.expandDirection === 'right' && 'left: -5px;'}

  ${p =>
    p.expanded &&
    `
    z-index: ${p.theme.zIndex.truncationFullValue};
    display: block;
    `}
`;

export default Truncate;
