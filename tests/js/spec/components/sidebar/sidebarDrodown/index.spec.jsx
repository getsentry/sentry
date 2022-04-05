import {mountWithTheme} from 'sentry-test/enzyme';

import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import LegacyConfigStore from 'sentry/stores/configStore';

function renderDropdown(props) {
  const user = LegacyConfigStore.get('user');
  const config = LegacyConfigStore.get('config');
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
