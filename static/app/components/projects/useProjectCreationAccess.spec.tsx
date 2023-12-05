import {Organization} from 'sentry-fixture/organization';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useProjectCreationAccess} from './useProjectCreationAccess';

describe('ProjectCreationAccess', function () {
  const organization = Organization();

  it('passes project creation eligibility for org-manager', function () {
    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('passes for members if org has team-roles', function () {
    const experiment_org = Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-roles'],
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: experiment_org},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails for members if org does not have team-roles', function () {
    const no_team_role_org = Organization({
      access: ['org:read', 'team:read', 'project:read'],
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: no_team_role_org},
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });
});
