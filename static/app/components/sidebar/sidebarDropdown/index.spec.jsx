import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import ConfigStore from 'sentry/stores/configStore';

function renderDropdown(props) {
  const user = ConfigStore.get('user');
  const config = ConfigStore.get('config');
  const organization = TestStubs.Organization({orgRole: 'member'});
  const routerContext = TestStubs.routerContext([
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
    {context: routerContext}
  );
}

describe('SidebarDropdown', function () {
  it('renders', async function () {
    const {container} = renderDropdown();
    expect(container).toSnapshot();
  });
  it('renders without org links', async function () {
    const {container} = renderDropdown({hideOrgLinks: true});
    expect(container).toSnapshot();
  });
  it('renders open sidebar', async function () {
    const config = {...ConfigStore.get('config'), singleOrganization: false};
    renderDropdown({collapsed: false, config});
    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.getByText('Switch organization')).toBeInTheDocument();
  });
  it('sandbox/demo mode render open sidebar', async function () {
    ConfigStore.set('demoMode', true);
    const config = {...ConfigStore.get('config'), singleOrganization: false};
    renderDropdown({collapsed: false, config});
    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.queryByText('Switch organization')).not.toBeInTheDocument();
  });
});
