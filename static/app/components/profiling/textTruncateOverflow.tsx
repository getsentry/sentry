import {ComponentProps, ElementType} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type TextOverflowProps<T extends ElementType> = ComponentProps<T> & {
  children: string;
  as?: T;
};

function TextOverflow<T extends ElementType>(props: TextOverflowProps<T>) {
  const {children, as: Element = 'div', ...rest} = props;
  return (
    <Element {...rest} title={children}>
      {children}
    </Element>
  );
}

// TextTruncateOverflow is strictly a css based text truncate component
export const TextTruncateOverflow = styled(TextOverflow)`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-right: ${space(1)};
` as typeof TextOverflow; // styled wasn't inferring the passed component properly this assertion is sufficient for now
