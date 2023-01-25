import {ElementType} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

interface TextTruncateOverflowProps {
  children: string;
  as?: ElementType<any>;
}

// TextTruncateOverflow is strictly a css based text truncate component
export const TextTruncateOverflow = styled(
  ({children, as: Element = 'div', ...props}: TextTruncateOverflowProps) => (
    <Element {...props} title={children}>
      {children}
    </Element>
  )
)`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-right: ${space(1)};
`;
