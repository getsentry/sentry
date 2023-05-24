const {useProjectCreationAccess} = require('./useProjectCreationAccess');

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import * as useExperiment from 'sentry/utils/useExperiment';

describe('ProjectCreationAccess', function () {
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

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 1,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeTruthy();
  });

  it('fails if org is not part of experiment and member has no access', function () {
    const organization = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: ['organizations:team-project-creation-all'],
      experiments: [{ProjectCreationForAllExperiment: 0}],
    });

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 0,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });

  it('fails if org does not have the feature regardress of experiment value', function () {
    const organization = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
      features: [],
      experiments: [{ProjectCreationForAllExperiment: 1}],
    });

    jest.spyOn(useExperiment, 'useExperiment').mockReturnValue({
      experimentAssignment: 1,
      logExperiment: jest.fn(),
    });

    const {result} = reactHooks.renderHook(useProjectCreationAccess, {
      initialProps: organization,
    });
    expect(result.current.canCreateProject).toBeFalsy();
  });
});
