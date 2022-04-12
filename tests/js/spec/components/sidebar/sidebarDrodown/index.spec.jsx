import {render} from 'sentry-test/reactTestingLibrary';

import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import ConfigStore from 'sentry/stores/configStore';

function renderDropdown(props) {
  const user = ConfigStore.get('user');
  const config = ConfigStore.get('config');
  const organization = TestStubs.Organization();
  return render(
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
    const {container} = renderDropdown();
    expect(container).toSnapshot();
  });
  it('renders without org links', function () {
    const {container} = renderDropdown({hideOrgLinks: true});
    expect(container).toSnapshot();
  });
});
