import {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {SidebarItems} from 'sentry/components/nav/sidebar';
import {IconClose, IconMenu, IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';

type NavView = 'primary' | 'secondary' | 'closed';

function MobileTopbar() {
  const location = useLocation();
  const [view, setView] = useState<NavView>('closed');
  /** Sync menu state with `body` attributes */
  useLayoutEffect(() => {
    updateNavStyleAttributes(view);
  }, [view]);
  /** Automatically close the menu after any navigation */
  useEffect(() => {
    setView('closed');
  }, [location.pathname]);
  const handleClick = useCallback(() => {
    setView(v => (v === 'closed' ? 'primary' : 'closed'));
  }, [setView]);

  return (
    <Topbar>
      <a href="/">
        <IconSentry />
      </a>
      <button onClick={handleClick}>
        {view === 'closed' ? <IconMenu width={16} /> : <IconClose width={16} />}
      </button>
      {view !== 'closed' ? (
        <OverlayPortal>
          <SidebarItems />
        </OverlayPortal>
      ) : null}
    </Topbar>
  );
}

export default MobileTopbar;

/** When the mobile menu opens, set the main content to `inert` and disable `body` scrolling */
function updateNavStyleAttributes(view: NavView) {
  const mainContent = document.getElementById('main');
  if (!mainContent) {
    throw new Error(
      'Unable to match "#main" element. Please add `id="main"` to the element which wraps the app content.'
    );
  }

  if (view !== 'closed') {
    mainContent.setAttribute('inert', '');
    document.body.style.setProperty('overflow', 'hidden');
  } else {
    mainContent.removeAttribute('inert');
    document.body.style.removeProperty('overflow');
  }
}

function OverlayPortal({children}: any) {
  return createPortal(<Overlay>{children}</Overlay>, document.body);
}

const Topbar = styled('div')`
  height: 40px;
  width: 100vw;
  padding: ${space(0.5)} ${space(1.5)} ${space(0.5)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.translucentGray100};
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: ${theme.zIndex.sidebar};

  svg {
    display: block;
    width: var(--size);
    height: var(--size);
    color: currentColor;
  }
  button {
    all: initial;
    --size: ${space(2)};
  }
  a {
    --size: ${space(3)};
  }
  a,
  button {
    color: rgba(255, 255, 255, 0.85);
    padding: ${space(1)};
    margin: -${space(1)};
    cursor: pointer;

    &:hover {
      color: white;
    }
  }
`;

const Overlay = styled('div')`
  position: fixed;
  top: 40px;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.surface300};
  z-index: ${p => p.theme.zIndex.modal};
  --color: ${p => p.theme.textColor};
  --color-hover: ${p => p.theme.activeText};
`;
