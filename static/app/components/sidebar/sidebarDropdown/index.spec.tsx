import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import ConfigStore from 'sentry/stores/configStore';

function renderDropdown(props: any = {}) {
  const user = UserFixture();
  const config = ConfigFixture();
  const organization = OrganizationFixture({orgRole: 'member'});
  const routerContext = RouterContextFixture([
    {
      organization,
    },
  ]);
  return render(
    <SidebarDropdown
      orientation="left"
      collapsed={false}
      user={user}
      config={config}
      org={organization}
      {...props}
    />,
    {context: routerContext, organization}
  );
}

describe('SidebarDropdown', function () {
  it('renders', function () {
    renderDropdown();
  });

  it('renders without org links', function () {
    renderDropdown({hideOrgLinks: true});
  });

  it('renders open sidebar', async function () {
    const config = ConfigFixture({
      singleOrganization: false,
    });
    renderDropdown({collapsed: false, config});
    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.getByText('Switch organization')).toBeInTheDocument();
  });

  it('sandbox/demo mode render open sidebar', async function () {
    ConfigStore.set('demoMode', true);
    const config = ConfigFixture({singleOrganization: false});
    renderDropdown({collapsed: false, config});
    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.queryByText('Switch organization')).not.toBeInTheDocument();
  });
});
