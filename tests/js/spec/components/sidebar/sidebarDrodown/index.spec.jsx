import {mountWithTheme} from 'sentry-test/enzyme';

import SidebarDropdown from 'app/components/sidebar/sidebarDropdown';
import ConfigStore from 'app/stores/configStore';

function renderDropdown(props) {
  const user = ConfigStore.get('user');
  const config = ConfigStore.get('config');
  const organization = TestStubs.Organization();
  return mountWithTheme(
    <SidebarDropdown
      orientation="left"
      collapsed={false}
      user={user}
      config={config}
      organization={organization}
      {...props}
    />
  );
}

describe('SidebarDropdown', function () {
  it('renders', function () {
    const component = renderDropdown();
    expect(component).toSnapshot();
  });
  it('renders without org links', function () {
    const component = renderDropdown({hideOrgLinks: true});
    expect(component).toSnapshot();
  });
});
