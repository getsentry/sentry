import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectTeamAccess from 'app/views/projectDetail/projectTeamAccess';

describe('ProjectDetail > ProjectTeamAccess', function () {
  const {organization, routerContext} = initializeOrg();

  it('renders a list', function () {
    const wrapper = mountWithTheme(
      <ProjectTeamAccess
        organization={organization}
        project={TestStubs.Project({teams: [TestStubs.Team()]})}
      />,
      routerContext
    );

    expect(wrapper.find('SectionHeading').text()).toBe('Team Access');
    expect(wrapper.find('IdBadge').text()).toBe('#team-slug');
    expect(wrapper.find('IdBadge').length).toBe(1);
  });

  it('links to a team settings', function () {
    const wrapper = mountWithTheme(
      <ProjectTeamAccess
        organization={organization}
        project={TestStubs.Project({teams: [TestStubs.Team()]})}
      />,
      routerContext
    );

    expect(wrapper.find('StyledLink').prop('to')).toBe(
      '/settings/org-slug/teams/team-slug/'
    );
  });

  it('displays the right empty state', function () {
    const wrapper = mountWithTheme(
      <ProjectTeamAccess organization={organization} project={TestStubs.Project()} />,
      routerContext
    );

    const assignTeamButton = wrapper.find('Link[aria-label="Assign Team"]');
    expect(assignTeamButton.prop('to')).toBe(
      '/settings/org-slug/projects/project-slug/teams/'
    );
    expect(assignTeamButton.text()).toBe('Assign Team');

    const wrapperNoPermissions = mountWithTheme(
      <ProjectTeamAccess
        organization={{...organization, access: []}}
        project={TestStubs.Project({teams: []})}
      />,
      routerContext
    );
    expect(wrapperNoPermissions.find('Button').prop('disabled')).toBeTruthy();
  });

  it('collapses more than 5 teams', function () {
    const wrapper = mountWithTheme(
      <ProjectTeamAccess
        organization={organization}
        project={TestStubs.Project({
          teams: [
            TestStubs.Team({slug: 'team1'}),
            TestStubs.Team({slug: 'team2'}),
            TestStubs.Team({slug: 'team3'}),
            TestStubs.Team({slug: 'team4'}),
            TestStubs.Team({slug: 'team5'}),
            TestStubs.Team({slug: 'team6'}),
            TestStubs.Team({slug: 'team7'}),
          ],
        })}
      />,
      routerContext
    );

    expect(wrapper.find('IdBadge').length).toBe(5);

    wrapper.find('button[aria-label="Show 2 collapsed teams"]').simulate('click');
    expect(wrapper.find('IdBadge').length).toBe(7);

    wrapper.find('button[aria-label="Collapse"]').simulate('click');
    expect(wrapper.find('IdBadge').length).toBe(5);
  });
});
