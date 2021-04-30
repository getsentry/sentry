import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationBadge from 'app/components/idBadge/organizationBadge';

describe('OrganizationBadge', function () {
  it('renders with Avatar and organization name', function () {
    const wrapper = mountWithTheme(
      <OrganizationBadge organization={TestStubs.Organization()} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('org-slug');
  });
});
