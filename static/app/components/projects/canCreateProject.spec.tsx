import {OrganizationFixture} from 'sentry-fixture/organization';

import {canCreateProject} from './canCreateProject';

describe('ProjectCreationAccess', () => {
  const organization = OrganizationFixture();

  it('passes project creation eligibility for org-manager', () => {
    const result = canCreateProject(organization);
    expect(result).toBeTruthy();
  });

  it('passes for members if org has team-roles', () => {
    const experiment_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
      allowMemberProjectCreation: true,
    });

    const result = canCreateProject(experiment_org);
    expect(result).toBeTruthy();
  });

  it('fails for members if org has team-roles but disabled allowMemberProjectCreation', () => {
    const experiment_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
      allowMemberProjectCreation: false,
    });

    const result = canCreateProject(experiment_org);
    expect(result).toBeFalsy();
  });

  it('fails for members if org does not have team-roles', () => {
    const no_team_role_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
    });

    const result = canCreateProject(no_team_role_org);
    expect(result).toBeFalsy();
  });
});
