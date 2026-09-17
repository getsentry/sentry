import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {canCreateProject} from './canCreateProject';

describe('ProjectCreationAccess', () => {
  const organization = OrganizationFixture();

  it('passes project creation eligibility for org-manager', () => {
    const result = canCreateProject(organization);
    expect(result).toBeTruthy();
  });

  it('passes for members when allowMemberProjectCreation is enabled', () => {
    const memberOrg = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      allowMemberProjectCreation: true,
    });

    const result = canCreateProject(memberOrg);
    expect(result).toBeTruthy();
  });

  it('passes for members without team-roles when allowMemberProjectCreation is enabled', () => {
    const memberOrg = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: [],
      allowMemberProjectCreation: true,
    });

    const result = canCreateProject(memberOrg);
    expect(result).toBeTruthy();
  });

  it('fails for members when allowMemberProjectCreation is disabled', () => {
    const memberOrg = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      allowMemberProjectCreation: false,
    });

    const result = canCreateProject(memberOrg);
    expect(result).toBeFalsy();
  });

  it('passes for team admins when allowMemberProjectCreation is disabled', () => {
    const memberOrg = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      allowMemberProjectCreation: false,
    });
    const teams = [
      TeamFixture({
        teamRole: 'admin',
        access: ['team:admin', 'team:write', 'team:read'],
      }),
    ];

    const result = canCreateProject(memberOrg, teams);
    expect(result).toBeTruthy();
  });
});
