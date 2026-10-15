import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {useIsStuck} from 'sentry/utils/useIsStuck';
import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

/**
 * A component that will become stuck to the top of the page. Once the user has
 * scrolled to it.
 *
 * The element will recieve a `data-stuck` attribute once it is stuck, useful
 * for additional styling when the element becomes stuck.
 */
interface StickyProps extends React.ComponentProps<'div'> {
  /** Additional distance from the top bar where the element should stick. */
  topOffset?: number;
}

function TaggedSticky({ref, topOffset = 0, ...props}: StickyProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {pageContentTop} = useTopOffset();
  const mergedRef = useMemo(() => mergeRefs(elementRef, ref), [ref]);
  const stickyTopOffset = (Number.parseInt(pageContentTop, 10) || 0) + topOffset;

  const isStuck = useIsStuck(elementRef, {
    offset: stickyTopOffset,
  });

  const stuckProps = isStuck ? {'data-stuck': ''} : {};

  return <div ref={mergedRef} {...stuckProps} {...props} />;
}

const Sticky = styled(TaggedSticky)`
  position: sticky;
  top: calc(var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px) + ${p => p.topOffset ?? 0}px);
`;

export {Sticky};
