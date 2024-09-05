import {createContext, type FC, useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SubnavContextData {
  setContent: any;
}

const subnavContext = createContext<SubnavContextData>({
  setContent: () => {},
});

export function SubnavContainer({children}) {
  const [content, setContent] = useState<ReturnType<FC>>([]);

  return (
    <subnavContext.Provider value={{setContent}}>
      {children}
      <SidebarSecondaryWrapper aria-label={t('Secondary Navigation')}>
        {content}
      </SidebarSecondaryWrapper>
    </subnavContext.Provider>
  );
}

export function SubnavPanel({children}) {
  const ctx = useContext(subnavContext);
  useEffect(() => {
    ctx.setContent(children);
  }, [children, ctx]);
  return null;
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
`;
