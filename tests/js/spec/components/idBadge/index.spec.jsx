import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IdBadge from 'app/components/idBadge';

describe('IdBadge', function () {
  const routerContext = TestStubs.routerContext();
  it('renders the correct component when `user` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge user={TestStubs.User()} />, routerContext);

    expect(wrapper.find('UserBadge')).toHaveLength(1);
  });

  it('renders the correct component when `team` property is passed', function () {
    const wrapper = mountWithTheme(<IdBadge team={TestStubs.Team()} />, routerContext);

    expect(wrapper.find('TeamBadgeContainer')).toHaveLength(1);
  });

  it('renders the correct component when `project` property is passed', function () {
    const wrapper = mountWithTheme(
      <IdBadge project={TestStubs.Project()} />,
      routerContext
    );

    expect(wrapper.find('ProjectBadge')).toHaveLength(1);
  });

  it('renders the correct component when `organization` property is passed', function () {
    const wrapper = mountWithTheme(
      <IdBadge organization={TestStubs.Organization()} />,
      routerContext
    );

    expect(wrapper.find('OrganizationBadge')).toHaveLength(1);
  });

  it('throws when no valid properties are passed', function () {
    console.error.mockReset(); // eslint-disable-line no-console
    expect(() => mountWithTheme(<IdBadge />, routerContext)).toThrow();
  });
});
