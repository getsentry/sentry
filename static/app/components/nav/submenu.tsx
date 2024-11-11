import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {useNavContext} from 'sentry/components/nav/context';
import type {NavSubmenuItem} from 'sentry/components/nav/utils';
import {
  isNavItemActive,
  isNonEmptyArray,
  makeLinkPropsFromTo,
} from 'sentry/components/nav/utils';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

function Submenu() {
  const nav = useNavContext();
  if (!nav.submenu) {
    return null;
  }

  return (
    <SubmenuWrapper role="navigation" aria-label="Secondary Navigation">
      <SubmenuBody>
        {nav.submenu.main.map(item => (
          <SubmenuItem key={item.label} item={item} />
        ))}
      </SubmenuBody>
      {isNonEmptyArray(nav.submenu.footer) && (
        <SubmenuFooter>
          {nav.submenu.footer.map(item => (
            <SubmenuItem key={item.label} item={item} />
          ))}
        </SubmenuFooter>
      )}
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
  width: 150px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
`;

function SubmenuItem({item}: {item: NavSubmenuItem}) {
  const location = useLocation();
  const isActive = isNavItemActive(item, location);
  const linkProps = makeLinkPropsFromTo(item.to);

  const FeatureGuard = item.feature ? Feature : Fragment;
  const featureGuardProps: any = item.feature ?? {};

  return (
    <FeatureGuard {...featureGuardProps}>
      <SubmenuItemWrapper>
        <SubmenuLink
          {...linkProps}
          aria-current={isActive ? 'page' : undefined}
          aria-selected={isActive}
        >
          <InteractionStateLayer hasSelectedBackground={isActive} />
          {item.label}
        </SubmenuLink>
      </SubmenuItemWrapper>
    </FeatureGuard>
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

function SubmenuBody({children}) {
  return <SubmenuItemList>{children}</SubmenuItemList>;
}

function SubmenuFooter({children}) {
  return (
    <SubmenuFooterWrapper>
      <SubmenuItemList>{children}</SubmenuItemList>
    </SubmenuFooterWrapper>
  );
}
