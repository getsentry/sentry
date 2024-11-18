import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {useNavContext} from 'sentry/components/nav/context';
import {space} from 'sentry/styles/space';

function Submenu({children}) {
  return (
    <SubmenuWrapper role="navigation" aria-label="Secondary Navigation">
      {children}
    </SubmenuWrapper>
  );
}

export default Submenu;

const SubmenuWrapper = styled('div')`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-direction: column;
  min-width: 150px;
  width: max-content;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
`;

export interface SubmenuItemProps {
  children: string | React.ReactElement<any, string | React.JSXElementConstructor<any>>;
  id: string;
  to: LocationDescriptor;
}
export function SubmenuItem({id, to, children}: SubmenuItemProps) {
  if (!id) {
    throw new Error(`SubmenuItem expected a unique \`id\` prop, but recieved \`${id}\``);
  }
  const {activeSubmenuId, setActiveSubmenuId} = useNavContext();
  const handleClick = useCallback(() => {
    setActiveSubmenuId(id);
  }, [setActiveSubmenuId, id]);
  const isActive = useMemo(() => activeSubmenuId === id, [activeSubmenuId, id]);

  return (
    <SubmenuItemWrapper>
      <SubmenuLink
        to={to}
        aria-current={isActive ? 'page' : undefined}
        aria-selected={isActive}
        onClick={handleClick}
      >
        <InteractionStateLayer hasSelectedBackground={isActive} />
        {children}
      </SubmenuLink>
    </SubmenuItemWrapper>
  );
}

const SubmenuLink = styled(Link)`
  position: relative;

  ${InteractionStateLayer} {
    transform: translate(0, 0);
    top: 1px;
    bottom: 1px;
    right: 0;
    left: 0;
    width: initial;
    height: initial;
  }
`;

const SubmenuItemList = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  width: 100%;
  color: ${p => p.theme.gray400};
`;

const SubmenuItemWrapper = styled('li')`
  a {
    display: flex;
    padding: 5px ${space(1.5)};
    height: 34px;
    align-items: center;
    color: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    font-weight: ${p => p.theme.fontWeightNormal};
    line-height: 177.75%;
    margin-inline: ${space(1)};
    border-radius: ${p => p.theme.borderRadius};

    &.active {
      color: ${p => p.theme.gray500};
      background: rgba(62, 52, 70, 0.09);
      border: 1px solid ${p => p.theme.translucentGray100};
    }
  }
`;

const SubmenuFooterWrapper = styled('div')`
  position: relative;
  border-top: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding-block: ${space(1)};
`;

export function SubmenuBody({children}) {
  return <SubmenuItemList>{children}</SubmenuItemList>;
}

export function SubmenuFooter({children}) {
  return (
    <SubmenuFooterWrapper>
      <SubmenuItemList>{children}</SubmenuItemList>
    </SubmenuFooterWrapper>
  );
}
