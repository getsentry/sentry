import {
  createContext,
  Fragment,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SubnavContextData {
  containerRef: RefObject<HTMLDivElement>;
}

const subnavContext = createContext<SubnavContextData>({
  containerRef: {current: null},
});

export function SubnavContainer({children}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.children.length === 0) {
      document.body.dataset.navLevel = '1';
    } else {
      document.body.dataset.navLevel = '2';
    }
  });
  return (
    <subnavContext.Provider value={{containerRef}}>
      {children}
      <SidebarSecondaryWrapper
        ref={containerRef}
        aria-label={t('Secondary Navigation')}
      />
    </subnavContext.Provider>
  );
}

export function SubnavPanel({children}) {
  const {containerRef} = useContext(subnavContext);
  if (!containerRef.current) return null;
  return <Fragment>{createPortal(children, containerRef.current)}</Fragment>;
}

export const SidebarSecondaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: ${p => p.theme.surface300};
  border-right: 1px solid ${p => p.theme.translucentGray200};
  width: ${p => p.theme.sidebar.v2_panelWidth};
  height: 100%;
  padding: ${space(1)} 0;

  &:empty {
    display: none;
  }
`;
