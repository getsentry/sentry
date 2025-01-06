import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  addOrganizationFeaturesHandler,
  addProjectFeaturesHandler,
} from 'sentry/utils/featureFlags';

describe('addOrganizationFeaturesHandler', () => {
  let organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['enable-issues', 'enable-replay'],
    });
  });

  it('should pass the flag name and result to the handler on each evaluation', () => {
    const mockHandler = jest.fn();
    addOrganizationFeaturesHandler({organization, handler: mockHandler});

    organization.features.includes('enable-replay');
    organization.features.includes('replay-mobile-ui');
    organization.features.includes('enable-issues');

    expect(mockHandler).toHaveBeenNthCalledWith(1, 'enable-replay', true);
    expect(mockHandler).toHaveBeenNthCalledWith(2, 'replay-mobile-ui', false);
    expect(mockHandler).toHaveBeenNthCalledWith(3, 'enable-issues', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHandler = jest.fn();
    addOrganizationFeaturesHandler({organization, handler: mockHandler});
    expect(organization.features).toContain('enable-issues');
    expect(organization.features).toContain('enable-replay');
    expect(organization.features).not.toContain('replay-mobile-ui');
  });
});

describe('addProjectFeaturesHandler', () => {
  let project;

  beforeEach(() => {
    project = ProjectFixture({
      features: ['enable-issues', 'enable-replay'],
    });
  });

  it('should pass the flag name and result to the handler on each evaluation', () => {
    const mockHandler = jest.fn();
    addProjectFeaturesHandler({project, handler: mockHandler});

    project.features.includes('enable-replay');
    project.features.includes('replay-mobile-ui');
    project.features.includes('enable-issues');

    expect(mockHandler).toHaveBeenNthCalledWith(1, 'enable-replay', true);
    expect(mockHandler).toHaveBeenNthCalledWith(2, 'replay-mobile-ui', false);
    expect(mockHandler).toHaveBeenNthCalledWith(3, 'enable-issues', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHandler = jest.fn();
    addProjectFeaturesHandler({project, handler: mockHandler});
    expect(project.features).toContain('enable-issues');
    expect(project.features).toContain('enable-replay');
    expect(project.features).not.toContain('replay-mobile-ui');
  });
});
