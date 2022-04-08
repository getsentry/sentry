import {mountWithTheme} from 'sentry-test/enzyme';

import IdBadge from 'sentry/components/idBadge';

describe('IdBadge', function () {
  it('renders the correct component when `user` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge user={TestStubs.User()} />);

    expect(wrapper.find('UserBadge')).toHaveLength(1);
  });

  it('renders the correct component when `team` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge team={TestStubs.Team()} />);

    expect(wrapper.find('[data-test-id="team-badge"]')).toHaveLength(1);
  });

  it('renders the correct component when `project` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge project={TestStubs.Project()} />);

    expect(wrapper.find('ProjectBadge')).toHaveLength(1);
  });

  it('renders the correct component when `organization` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge organization={TestStubs.Organization()} />);

    expect(wrapper.find('OrganizationBadge')).toHaveLength(1);
  });

  it('throws when no valid properties are passed', function () {
    expect(() => mountWithTheme(<IdBadge />)).toThrow();
  });
});
