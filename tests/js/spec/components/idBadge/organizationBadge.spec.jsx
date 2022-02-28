import {enzymeRender} from 'sentry-test/enzyme';

import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';

describe('OrganizationBadge', function () {
  it('renders with Avatar and organization name', function () {
    const wrapper = enzymeRender(
      <OrganizationBadge organization={TestStubs.Organization()} />
    );
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('org-slug');
  });
});
