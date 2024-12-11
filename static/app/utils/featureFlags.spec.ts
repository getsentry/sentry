import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  addOrganizationFeaturesHook,
  addProjectFeaturesHook,
} from 'sentry/utils/featureFlags';

describe('addOrganizationFeaturesHook', () => {
  let organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['enable-issues', 'enable-replay'],
    });
  });

  it('should pass the flag name and result to the hook on each evaluation', () => {
    const mockHook = jest.fn();
    addOrganizationFeaturesHook({organization, hook: mockHook});

    organization.features.includes('enable-replay');
    organization.features.includes('replay-mobile-ui');
    organization.features.includes('enable-issues');

    expect(mockHook).toHaveBeenNthCalledWith(1, 'enable-replay', true);
    expect(mockHook).toHaveBeenNthCalledWith(2, 'replay-mobile-ui', false);
    expect(mockHook).toHaveBeenNthCalledWith(3, 'enable-issues', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHook = jest.fn();
    addOrganizationFeaturesHook({organization, hook: mockHook});
    expect(organization.features.includes('enable-issues')).toBe(true);
    expect(organization.features.includes('enable-replay')).toBe(true);
    expect(organization.features.includes('replay-mobile-ui')).toBe(false);
  });
});

describe('addProjectFeaturesHook', () => {
  let project;

  beforeEach(() => {
    project = ProjectFixture({
      features: ['enable-issues', 'enable-replay'],
    });
  });

  it('should pass the flag name and result to the hook on each evaluation', () => {
    const mockHook = jest.fn();
    addProjectFeaturesHook({project, hook: mockHook});

    project.features.includes('enable-replay');
    project.features.includes('replay-mobile-ui');
    project.features.includes('enable-issues');

    expect(mockHook).toHaveBeenNthCalledWith(1, 'enable-replay', true);
    expect(mockHook).toHaveBeenNthCalledWith(2, 'replay-mobile-ui', false);
    expect(mockHook).toHaveBeenNthCalledWith(3, 'enable-issues', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHook = jest.fn();
    addProjectFeaturesHook({project, hook: mockHook});
    expect(project.features.includes('enable-issues')).toBe(true);
    expect(project.features.includes('enable-replay')).toBe(true);
    expect(project.features.includes('replay-mobile-ui')).toBe(false);
  });
});
