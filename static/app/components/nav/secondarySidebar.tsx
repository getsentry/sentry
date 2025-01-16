import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {useNavContext} from 'sentry/components/nav/context';

export function SecondarySidebar() {
  const ref = useRef<HTMLDivElement>(null);
  const {setSecondaryNavEl} = useNavContext();

  useEffect(() => {
    if (ref.current) {
      setSecondaryNavEl(ref.current);
    }
  }, [ref, setSecondaryNavEl]);

  return <SecondarySidebarWrapper ref={ref} />;
}

const SecondarySidebarWrapper = styled('div')`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-direction: column;
  width: 190px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;
