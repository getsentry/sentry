import styled from '@emotion/styled';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {useNavItems} from 'sentry/components/nav/config';
import {Mobile} from 'sentry/components/nav/mobile';
import Sidebar from 'sentry/components/nav/sidebar';
import Submenu from 'sentry/components/nav/submenu';
import {useBreakpoints} from 'sentry/utils/metrics/useBreakpoints';
import useOrganization from 'sentry/utils/useOrganization';

function Nav() {
  const organization = useOrganization();
  const nav = useNavItems();
  const screen = useBreakpoints();

  if (!screen.medium) {
    return (
      <NavContainer>
        <Mobile />
      </NavContainer>
    );
  }

  return (
    <NavContainer>
      <Sidebar role="navigation" aria-label="Primary Navigation">
        <Sidebar.Header>
          <OrganizationAvatar organization={organization} size={32} />
        </Sidebar.Header>
        <Sidebar.Body>
          {nav.primary.body.map(item => (
            <Sidebar.Item key={item.label} {...item} />
          ))}
        </Sidebar.Body>
        <Sidebar.Footer>
          {nav.primary.footer.map(item => (
            <Sidebar.Item key={item.label} {...item} />
          ))}
        </Sidebar.Footer>
      </Sidebar>
      {nav.secondary.body.length > 0 && (
        <Submenu role="navigation" aria-label="Secondary Navigation">
          <Submenu.Body>
            {nav.secondary.body.map(item => (
              <Submenu.Item key={item.label} {...item} />
            ))}
          </Submenu.Body>
          {nav.secondary.footer.length > 0 && (
            <Submenu.Footer>
              {nav.secondary.footer.map(item => (
                <Submenu.Item key={item.label} {...item} />
              ))}
            </Submenu.Footer>
          )}
        </Submenu>
      )}
    </NavContainer>
  );
}

const NavContainer = styled('div')`
  display: flex;
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.sidebarPanel};

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    bottom: 0;
    height: 100vh;
    height: 100dvh;
  }
`;

export default Nav;
