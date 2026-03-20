import {useRef} from 'react';
import styled from '@emotion/styled';

import {useIsStuck} from 'sentry/utils/useIsStuck';

const StickyFooterBase = styled('div')`
  position: sticky;
  margin-top: auto;
  bottom: 0;
  right: 0;
  width: 100%;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
  background: ${p => p.theme.tokens.background.primary};
  border-top: 1px solid ${p => p.theme.colors.gray200};
  box-shadow: none;
  justify-content: flex-end;
  gap: ${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.initial};

  &[data-stuck] {
    box-shadow: ${p => p.theme.dropShadowHeavyTop};
  }
`;

export function StickyFooter(props: React.ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  // Use a bottom-focused rootMargin so the hook reports stuck when pinned at bottom.
  const isStuck = useIsStuck(ref.current, {position: 'bottom'});
  const stuckProps = isStuck ? {'data-stuck': ''} : {};
  return <StickyFooterBase ref={ref} {...stuckProps} {...props} />;
}
