import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {useNavItems} from 'sentry/components/nav/config';
import Sidebar from 'sentry/components/nav/sidebar';
import {IconClose, IconMenu, IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';

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

export function Mobile() {
  const nav = useNavItems();
  const [view, setView] = useState<'closed' | 'primary' | 'secondary'>('closed');
  const handleClick = useCallback(() => {
    setView(value => (value === 'closed' ? 'primary' : 'closed'));
  }, [setView]);

  const location = useLocation();

  useEffect(() => {
    setView('closed');
  }, [location.pathname, setView]);

  useEffect(() => {
    const body = document.body;
    const app = document.querySelector('.app > :not(nav)');
    if (view !== 'closed') {
      app?.setAttribute('inert', '');
      body.style.setProperty('overflow', 'hidden');
    } else {
      app?.removeAttribute('inert');
      body.style.removeProperty('overflow');
    }
  }, [view]);

  return (
    <Topbar>
      <a href="/">
        <IconSentry />
      </a>
      <button onClick={handleClick}>
        {view === 'closed' ? <IconMenu width={16} /> : <IconClose width={16} />}
      </button>
      <OverlayPortal active={view !== 'closed'}>
        <Sidebar.Body>
          {nav.primary.body.map(item => (
            <Sidebar.Item key={item.to} {...item} />
          ))}
        </Sidebar.Body>
        <Sidebar.Footer>
          {nav.primary.footer.map(item => (
            <Sidebar.Item key={item.to} {...item} />
          ))}
        </Sidebar.Footer>
      </OverlayPortal>
    </Topbar>
  );
}

function OverlayPortal({active = false, children}) {
  if (!active) return null;
  return createPortal(<Overlay>{children}</Overlay>, document.body);
}

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
