import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useProjectCreationAccess} from './useProjectCreationAccess';

describe('ProjectCreationAccess', function () {
  const organization = OrganizationFixture();

  it('passes project creation eligibility for org-manager', function () {
    const {result} = renderHook(useProjectCreationAccess, {
      initialProps: {organization},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('passes for members if org has team-roles', function () {
    const experiment_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
    });

    const {result} = renderHook(useProjectCreationAccess, {
      initialProps: {organization: experiment_org},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails for members if org does not have team-roles', function () {
    const no_team_role_org = OrganizationFixture({
      access: ['org:read', 'team:read', 'project:read'],
    });

    const {result} = renderHook(useProjectCreationAccess, {
      initialProps: {organization: no_team_role_org},
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });
});
