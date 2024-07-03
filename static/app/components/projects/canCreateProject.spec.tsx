import {OrganizationFixture} from 'sentry-fixture/organization';

import {canCreateProject} from './canCreateProject';

describe('ProjectCreationAccess', function () {
  const organization = OrganizationFixture();

  it('passes project creation eligibility for org-manager', function () {
    const result = canCreateProject(organization);
    expect(result).toBeTruthy();
  });

  it('passes for members if org has team-roles', function () {
    const experiment_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
      allowMemberProjectCreation: true,
    });

    const result = canCreateProject(experiment_org);
    expect(result).toBeTruthy();
  });

  it('fails for members if org has team-roles but disabled allowMemberProjectCreation', function () {
    const experiment_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
      allowMemberProjectCreation: false,
    });

    const result = canCreateProject(experiment_org);
    expect(result).toBeFalsy();
  });

  it('fails for members if org does not have team-roles', function () {
    const no_team_role_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
    });

    const result = canCreateProject(no_team_role_org);
    expect(result).toBeFalsy();
  });
});
