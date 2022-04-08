import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';

describe('ProjectBadge', function () {
  it('renders with Avatar and team name', function () {
    const wrapper = mountWithTheme(<ProjectBadge project={TestStubs.Project()} />);
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('PlatformList')).toHaveLength(1);
    expect(wrapper.find('BadgeDisplayName').text()).toEqual('project-slug');
  });
});
