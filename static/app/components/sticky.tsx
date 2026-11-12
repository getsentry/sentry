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
  /**
   * Where the element sticks. Defaults to just below the top bar. Use
   * `scrollContainer` when the element scrolls inside its own container rather
   * than the page, so the top bar height is not added.
   */
  relativeTo?: 'topBar' | 'scrollContainer';
  /** Additional distance from the `relativeTo` edge where the element should stick. */
  topOffset?: number;
}

function TaggedSticky({
  ref,
  relativeTo = 'topBar',
  topOffset = 0,
  ...props
}: StickyProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {pageContentTop} = useTopOffset();
  const mergedRef = useMemo(() => mergeRefs(elementRef, ref), [ref]);
  const baseTopOffset =
    relativeTo === 'topBar' ? Number.parseInt(pageContentTop, 10) || 0 : 0;
  const stickyTopOffset = baseTopOffset + topOffset;

  const isStuck = useIsStuck(elementRef, {
    offset: stickyTopOffset,
  });

  const stuckProps = isStuck ? {'data-stuck': ''} : {};

  return <div ref={mergedRef} {...stuckProps} {...props} />;
}

const Sticky = styled(TaggedSticky)`
  position: sticky;
  top: ${p =>
    p.relativeTo === 'scrollContainer'
      ? `${p.topOffset ?? 0}px`
      : `calc(var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px) + ${p.topOffset ?? 0}px)`};
`;

export {Sticky};
