const {useProjectCreationAccess} = require('./useProjectCreationAccess');

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import * as useExperiment from 'sentry/utils/useExperiment';

describe('ProjectCreationAccess', function () {
  const organization = TestStubs.Organization();
  const teams = [TestStubs.Team()];

  it('passes project creation eligibility for org-manager', function () {
    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization, teams},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails project creation eligibility for org-members', function () {
    const member_org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: member_org, teams},
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });

  it('passes project creation eligibility for team-admin', function () {
    const member_org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
    });
    const admin_teams = [
      {...TestStubs.Team(), access: ['team:admin', 'team:write', 'team:read']},
    ];

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: member_org, teams: admin_teams},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('passes if org is part of experiment and member has no access', function () {
    const experiment_org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-project-creation-all'],
      experiments: [{ProjectCreationForAllExperiment: 1}],
    });

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 1,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: experiment_org, teams},
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails if org is not part of experiment and member has no access', function () {
    const no_exp_org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['team-project-creation-all'],
      experiments: [{ProjectCreationForAllExperiment: 0}],
    });

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 0,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: no_exp_org, teams},
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });

  it('fails if org does not have the feature regardless of experiment value', function () {
    const no_flag_org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: [],
      experiments: [{ProjectCreationForAllExperiment: 1}],
    });

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 1,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: {organization: no_flag_org, teams},
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });
});
