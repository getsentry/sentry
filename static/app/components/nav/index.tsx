import styled from '@emotion/styled';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {useNavItems} from 'sentry/components/nav/config';
import Sidebar from 'sentry/components/nav/sidebar';
import Submenu from 'sentry/components/nav/submenu';
import useOrganization from 'sentry/utils/useOrganization';

function Nav() {
  const organization = useOrganization();
  const nav = useNavItems();

  return (
    <NavContainer>
      <Sidebar>
        <Sidebar.Header>
          <OrganizationAvatar organization={organization} size={32} />
        </Sidebar.Header>
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
      </Sidebar>
      {nav.secondary.body.length > 0 && (
        <Submenu>
          <Submenu.Body>
            {nav.secondary.body.map(item => (
              <Submenu.Item key={item.to} {...item} />
            ))}
          </Submenu.Body>
          {nav.secondary.footer.length > 0 && (
            <Submenu.Footer>
              {nav.secondary.footer.map(item => (
                <Submenu.Item key={item.to} {...item} />
              ))}
            </Submenu.Footer>
          )}
        </Submenu>
      )}
    </NavContainer>
  );
}

const NavContainer = styled('nav')`
  position: sticky;
  top: 0;
  bottom: 0;
  height: 100vh;
  height: 100dvh;
  display: flex;
`;

export default Nav;
