import {useRef} from 'react';
import styled from '@emotion/styled';

import {useIsStuck} from 'sentry/utils/useIsStuck';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const StickyFooterBase = styled('div', {
  shouldForwardProp: prop => prop !== 'hasPageFrameFeature',
})<{hasPageFrameFeature: boolean}>`
  position: sticky;
  margin-top: auto;
  bottom: 0;
  right: 0;
  width: 100%;
  padding: ${p =>
    `${p.theme.space.xl} ${p.hasPageFrameFeature ? p.theme.space.xl : p.theme.space['3xl']}`};
  background: ${p => p.theme.tokens.background.primary};
  border-top: 1px solid ${p => p.theme.colors.gray200};
  box-shadow: none;
  justify-content: flex-end;
  gap: ${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.initial};

  &[data-stuck] {
    /* TODO(design-engineering): Replace with a directional shadow token when one exists */
    box-shadow:
      0px -4px 0px 2px ${p => p.theme.tokens.elevation.high},
      0px -1px 0px 1px ${p => p.theme.tokens.elevation.high};
  }
`;

export function StickyFooter(props: React.ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const hasPageFrameFeature = useHasPageFrameFeature();
  // Use a bottom-focused rootMargin so the hook reports stuck when pinned at bottom.
  const isStuck = useIsStuck(ref.current, {position: 'bottom'});
  const stuckProps = isStuck ? {'data-stuck': ''} : {};
  return (
    <StickyFooterBase
      ref={ref}
      hasPageFrameFeature={hasPageFrameFeature}
      {...stuckProps}
      {...props}
    />
  );
}
