import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {IconClose, IconMenu, IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

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
  const [view, setView] = useState<'closed' | 'primary' | 'secondary'>('closed');
  const handleClick = useCallback(() => {
    setView(value => (value === 'closed' ? 'primary' : 'closed'));
  }, [setView]);

  useEffect(() => {
    const body = document.body;
    const app = document.querySelector('#app');
    if (view !== 'closed') {
      app?.setAttribute('inert', '');
      body.style.overflow = 'hidden';
    } else {
      app?.removeAttribute('inert');
      body.style.overflow = 'auto';
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
      {view !== 'closed' && createPortal(<Overlay />, document.body)}
    </Topbar>
  );
}

const Overlay = styled('div')`
  position: fixed;
  top: 40px;
  right: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.surface300};
  z-index: ${p => p.theme.zIndex.modal};
`;
