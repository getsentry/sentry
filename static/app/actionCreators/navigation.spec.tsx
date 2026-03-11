import type {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {openModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Config} from 'sentry/types/system';

jest.mock('sentry/actionCreators/modal');

describe('navigation ActionCreator', () => {
  let navigate: jest.Mock;
  let location: Location;
  let configState: Config;

  beforeEach(() => {
    ProjectsStore.init();
    const initialData = initializeOrg();
    navigate = jest.fn();
    location = {...initialData.router.location, query: {}};
    ProjectsStore.loadInitialData(initialData.projects);
    configState = ConfigStore.getState();
  });

  afterEach(() => {
    ProjectsStore.reset();
    jest.resetAllMocks();
    ConfigStore.loadInitialData(configState);
  });

  it('should get project from query parameters', () => {
    location.query.project = '2';
    navigateTo('/settings/:projectId/alert', navigate, location);
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings/project-slug/alert');
  });

  it('should get project id from query parameters', () => {
    location.query.project = '2';
    navigateTo(
      '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
      navigate,
      location
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      '/organizations/albertos-apples/performance/?project=2#performance-sidequest'
    );
  });

  it('should get project and project id from query parameters', () => {
    location.query.project = '2';
    navigateTo(
      '/settings/:projectId/alert?project=:project#performance-sidequest',
      navigate,
      location
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      '/settings/project-slug/alert?project=2#performance-sidequest'
    );
  });

  it('should open modal if the store is somehow missing selected projectId', () => {
    location.query.project = '911';
    navigateTo('/settings/:projectId/alert', navigate, location);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project is selected', () => {
    navigateTo('/settings/:projectId/alert', navigate, location);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project id is selected', () => {
    navigateTo(
      '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
      navigate,
      location
    );
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal if more than one project is selected', () => {
    location.query.project = ['1', '2', '3'];
    navigateTo('/settings/:projectId/alert', navigate, location);
    expect(openModal).toHaveBeenCalled();
  });

  it('should not open modal if url does not require project id', () => {
    navigateTo('/settings/alert', navigate, location);
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings/alert');
  });

  it('should open modal for orgId', () => {
    navigateTo('/settings/:orgId', navigate, location);
    expect(openModal).toHaveBeenCalled();
  });

  it('normalizes URLs for customer domains', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'albertos-apples',
      organizationUrl: 'https://albertos-apples.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    navigateTo('/settings/org-slug/projects/', navigate, location);
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings/projects/');

    location.query.project = '2';
    navigateTo('/settings/org-slug/projects/:projectId/alerts/', navigate, location);
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings/projects/project-slug/alerts/');
  });

  it('should open modal for teamId and require both org and team context', () => {
    navigateTo('/settings/:orgId/teams/:teamId/settings/', navigate, location);
    expect(openModal).toHaveBeenCalled();

    const modalFactory = (openModal as jest.Mock).mock.calls[0]?.[0];
    if (!modalFactory) {
      throw new Error('Expected openModal to be called with a renderer');
    }

    const modal = modalFactory({closeModal: jest.fn()} as any);
    expect(modal.props.needOrg).toBe(true);
    expect(modal.props.needTeam).toBe(true);
  });

  it('preserves query parameters in path object', () => {
    location.query.project = '2';
    navigateTo(
      {
        pathname: '/settings/:projectId/alert?project=:project#performance-sidequest',
        query: {referrer: 'onboarding_task'},
      },
      navigate,
      location
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/settings/project-slug/alert?project=2#performance-sidequest',
      query: {referrer: 'onboarding_task'},
    });
  });
});
