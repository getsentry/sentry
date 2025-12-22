import styled from '@emotion/styled';

import {LINE_HEIGHT} from 'sentry/components/prevent/virtualRenderers/constants';
import {space} from 'sentry/styles/space';

interface ScrollBarProps {
  scrollBarRef: React.RefObject<HTMLDivElement | null>;
  wrapperWidth: `${number}px` | '100%';
}

export function ScrollBar({scrollBarRef, wrapperWidth}: ScrollBarProps) {
  return (
    <ScrollBarDiv
      ref={scrollBarRef}
      style={{height: `${LINE_HEIGHT - 3}px`}}
      data-test-id="virtual-renderer-scroll-bar"
    >
      <div style={{width: wrapperWidth, height: '1px'}} />
    </ScrollBarDiv>
  );
}

const ScrollBarDiv = styled('div')`
  padding-top: ${space(2)};
  height: ${LINE_HEIGHT - 3}px;
  pointer-events: auto;
  position: sticky;
  bottom: 0;
  z-index: 2;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: var(--prism-block-background);
  border-left: 2px solid ${p => p.theme.colors.gray200};
  border-right: 2px solid ${p => p.theme.colors.gray200};
  border-bottom: 2px solid ${p => p.theme.colors.gray200};
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
`;
