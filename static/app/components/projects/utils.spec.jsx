const {canViewerCreateProjects} = require('./utils');

describe('ProjectUtils', function () {
  it('passes project creation eligibility for project admin', function () {
    const org = TestStubs.Organization();
    expect(canViewerCreateProjects(org)).toBeTruthy();
  });

  it('fails project creation eligibility for org members', function () {
    const org = TestStubs.Organization({
      access: ['org:read', 'team:read', 'project:read'],
    });
    expect(canViewerCreateProjects(org)).toBeFalsy();
  });
});
