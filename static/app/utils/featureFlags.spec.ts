import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {addOrganizationFeaturesHandler, addProjectFeaturesHandler} from './featureFlags';

describe('addOrganizationFeaturesHandler', () => {
  let organization: any;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['issue-views', 'session-replay-ui'],
    });
  });

  it('should pass the flag name and result to the handler on each evaluation', () => {
    const mockHandler = jest.fn();
    addOrganizationFeaturesHandler({organization, handler: mockHandler});

    organization.features.includes('session-replay-ui');
    organization.features.includes('replay-mobile-ui');
    organization.features.includes('issue-views');

    expect(mockHandler).toHaveBeenNthCalledWith(1, 'session-replay-ui', true);
    expect(mockHandler).toHaveBeenNthCalledWith(2, 'replay-mobile-ui', false);
    expect(mockHandler).toHaveBeenNthCalledWith(3, 'issue-views', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHandler = jest.fn();
    addOrganizationFeaturesHandler({organization, handler: mockHandler});
    expect(organization.features).toContain('issue-views');
    expect(organization.features).toContain('session-replay-ui');
    expect(organization.features).not.toContain('replay-mobile-ui');
  });
});

describe('addProjectFeaturesHandler', () => {
  let project: any;

  beforeEach(() => {
    project = ProjectFixture({
      features: ['custom-inbound-filters', 'rate-limits'],
    });
  });

  it('should pass the flag name and result to the handler on each evaluation', () => {
    const mockHandler = jest.fn();
    addProjectFeaturesHandler({project, handler: mockHandler});

    project.features.includes('rate-limits');
    project.features.includes('discard-groups');
    project.features.includes('custom-inbound-filters');

    expect(mockHandler).toHaveBeenNthCalledWith(1, 'rate-limits', true);
    expect(mockHandler).toHaveBeenNthCalledWith(2, 'discard-groups', false);
    expect(mockHandler).toHaveBeenNthCalledWith(3, 'custom-inbound-filters', true);
  });

  it('should not change the functionality of `includes`', () => {
    const mockHandler = jest.fn();
    addProjectFeaturesHandler({project, handler: mockHandler});
    expect(project.features).toContain('custom-inbound-filters');
    expect(project.features).toContain('rate-limits');
    expect(project.features).not.toContain('discard-groups');
  });
});
