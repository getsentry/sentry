import {useRef} from 'react';
import styled from '@emotion/styled';

import {useIsStuck} from 'sentry/utils/useIsStuck';

/**
 * A component that will become stuck to the top of the page. Once the user has
 * scrolled to it.
 *
 * The element will recieve a `data-stuck` attribute once it is stuck, useful
 * for additional styling when the element becomes stuck.
 */
function TaggedSticky(props: React.ComponentProps<'div'>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const isStuck = useIsStuck(elementRef.current);

  const stuckProps = isStuck ? {'data-stuck': ''} : {};

  return <div ref={elementRef} {...stuckProps} {...props} />;
}

const Sticky = styled(TaggedSticky)`
  position: sticky;
  top: 0;
`;

export {Sticky};
