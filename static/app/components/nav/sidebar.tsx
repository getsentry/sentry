import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Link from 'sentry/components/links/link';
import {useIndicator} from 'sentry/components/nav/useIndicator';
import {isActive, type SidebarItem} from 'sentry/components/nav/utils';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';

const Sidebar = styled('div')`
  width: 74px;
  padding: ${space(2)} 0;
  border-right: 1px solid ${theme.translucentGray100};
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.sidebar};
`;

// const SidebarItems = styled('ul')`
//   list-style: none;
//   margin: 0;
//   padding: 0;
//   display: flex;
//   flex-direction: row;
// `

function Items({children}) {
  const {indicatorProps, containerProps} = useIndicator();

  return (
    <Fragment>
      <Indicator {...indicatorProps} />
      <ItemList {...containerProps}>{children}</ItemList>
    </Fragment>
  );
}

const ItemList = styled('ul')`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  width: 100%;
  color: rgba(255, 255, 255, 0.85);
`;

function Item({
  to,
  label,
  icon,
  submenu,
  ...props
}: React.PropsWithChildren<SidebarItem>) {
  const location = useLocation();
  return (
    <ItemWrapper>
      <Link
        to={to}
        aria-current={isActive({to, label, submenu}, location) ? 'page' : undefined}
        {...props}
      >
        {icon}
        {label}
      </Link>
    </ItemWrapper>
  );
}

const ItemWrapper = styled('li')`
  svg {
    padding-top: ${space(0.5)};
    width: 18px;
    height: 18px;
  }
  a {
    display: flex;
    flex-direction: column;
    padding: 4px 6px;
    align-items: center;
    justify-content: center;
    height: 53px;
    color: inherit;
    font-size: ${theme.fontSizeExtraSmall};
    font-weight: ${theme.fontWeightNormal};
    line-height: 177.75%;
    margin-inline: ${space(1)};
    border-radius: ${theme.borderRadius};

    &:hover {
      color: ${theme.white};
      /* background: rgba(62, 52, 70, 0.09); */
    }

    &[aria-current='page'] {
      color: ${theme.white};
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.1);
    }
  }
`;

const Indicator = styled(motion.span)`
  position: absolute;
  left: 0;
  right: 0;
  opacity: 0;
  pointer-events: none;
  margin-inline: ${space(1)};
  width: 58px;
  height: 53px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: ${theme.borderRadius};
`;

const FooterWrapper = styled('div')`
  position: relative;
  border-top: 1px solid ${theme.translucentGray200};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding-bottom: ${space(0.5)};
  margin-top: auto;
`;

const Header = styled('header')`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(1.5)};
`;

function Body({children}) {
  return (
    <div>
      <Items>{children}</Items>
    </div>
  );
}

function Footer({children}) {
  return (
    <FooterWrapper>
      <Items>{children}</Items>
    </FooterWrapper>
  );
}

export default Object.assign(Sidebar, {Header, Body, Footer, Item});
