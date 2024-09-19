import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Feature from 'sentry/components/acl/feature';
import Link from 'sentry/components/links/link';
import {useIndicator} from 'sentry/components/nav/useIndicator';
import type {SidebarItem} from 'sentry/components/nav/utils';
import {
  getActiveProps,
  getActiveStatus,
  useLocationDescriptor,
} from 'sentry/components/nav/utils';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';

export const Sidebar = styled('div')`
  height: 40px;
  width: 100vw;
  padding: ${space(2)} 0;
  border-right: 1px solid ${theme.translucentGray100};
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.sidebar};

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    height: unset;
    width: 74px;
  }
`;

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
  width: 100%;
  color: rgba(255, 255, 255, 0.85);

  @media screen and (min-width: ${p => p.theme.breakpoints.medium} {
    gap: ${space(1)};
  }
`;

function Item({
  to,
  label,
  icon,
  submenu,
  check,
  ...props
}: React.PropsWithChildren<SidebarItem>) {
  const location = useLocation();
  const activeProps = getActiveProps(getActiveStatus({to, label, submenu}, location));
  const toProps = useLocationDescriptor(to);

  const FeatureGuard = check ? Feature : Fragment;
  const featureGuardProps: any = check
    ? {
        features: check.features,
        hookName: check.hook ? (`feature-disabled:${check.hook}` as const) : undefined,
      }
    : {};

  return (
    <FeatureGuard {...featureGuardProps}>
      <ItemWrapper>
        <Link to={toProps} {...props} {...activeProps}>
          {icon}
          <span>{label}</span>
        </Link>
      </ItemWrapper>
    </FeatureGuard>
  );
}

const ItemWrapper = styled('li')`
  svg {
    --size: 14px;
    width: var(--size);
    height: var(--size);

    @media (min-width: ${p => p.theme.breakpoints.medium}) {
      --size: 18px;
      padding-top: ${space(0.5)};
    }
  }
  a {
    display: flex;
    flex-direction: row;
    height: 32px;
    gap: ${space(1.5)};
    align-items: center;
    padding: 0 ${space(1.5)};
    color: var(--color, currentColor);
    font-size: ${theme.fontSizeMedium};
    font-weight: ${theme.fontWeightNormal};
    line-height: 177.75%;
    border: 1px solid transparent;

    &:hover {
      color: var(--color-hover, ${theme.white});
    }

    &.active {
      color: var(--color-hover, ${theme.white});
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    @media (min-width: ${p => p.theme.breakpoints.medium}) {
      flex-direction: column;
      justify-content: center;
      height: 53px;
      padding: ${space(0.5)} ${space(0.75)};
      border-radius: ${theme.borderRadius};
      font-size: ${theme.fontSizeExtraSmall};
      margin-inline: ${space(1)};
      gap: ${space(0.5)};
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
