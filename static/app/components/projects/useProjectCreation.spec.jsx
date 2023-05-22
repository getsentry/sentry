const {useProjectCreationAccess} = require('./useProjectCreationAccess');

import {reactHooks} from 'sentry-test/reactTestingLibrary';

describe('ProjectUtils', function () {
  it('passes project creation eligibility for project admin', function () {
    const organization = TestStubs.Organization();
    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails project creation eligibility for org members', function () {
    const organization = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
    });
    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });

  it('passes if org is part of experiment and member has no access', function () {
    const organization = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['organizations:team-project-creation-all'],
      experiments: [{ProjectCreationForAllExperiment: 1}],
    });
    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  // add test for managed org
});
