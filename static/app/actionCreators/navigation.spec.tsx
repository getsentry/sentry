import {initializeOrg} from 'sentry-test/initializeOrg';

import {openModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Config} from 'sentry/types/system';

jest.mock('sentry/actionCreators/modal');

describe('navigation ActionCreator', () => {
  let router: InjectedRouter;
  let configState: Config;

  beforeEach(() => {
    ProjectsStore.init();
    const initialData = initializeOrg({
      router: {
        location: {query: {}, search: ''},
        push: jest.fn(),
      },
    });
    router = initialData.router;
    ProjectsStore.loadInitialData(initialData.projects);
    configState = ConfigStore.getState();
  });

  afterEach(() => {
    ProjectsStore.reset();
    jest.resetAllMocks();
    ConfigStore.loadInitialData(configState);
  });

  it('should get project from query parameters', () => {
    router.location.query.project = '2';
    navigateTo('/settings/:projectId/alert', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/project-slug/alert');
  });

  it('should get project id from query parameters', () => {
    router.location.query.project = '2';
    navigateTo(
      '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
      router
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/albertos-apples/performance/?project=2#performance-sidequest'
    );
  });

  it('should get project and project id from query parameters', () => {
    router.location.query.project = '2';
    navigateTo(
      '/settings/:projectId/alert?project=:project#performance-sidequest',
      router
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/settings/project-slug/alert?project=2#performance-sidequest'
    );
  });

  it('should open modal if the store is somehow missing selected projectId', () => {
    router.location.query.project = '911';
    navigateTo('/settings/:projectId/alert', router);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project is selected', () => {
    navigateTo('/settings/:projectId/alert', router);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project id is selected', () => {
    navigateTo(
      '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
      router
    );
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal if more than one project is selected', () => {
    router.location.query.project = ['1', '2', '3'];
    navigateTo('/settings/:projectId/alert', router);
    expect(openModal).toHaveBeenCalled();
  });

  it('should not open modal if url does not require project id', () => {
    navigateTo('/settings/alert', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/alert');
  });

  it('should open modal for orgId', () => {
    navigateTo('/settings/:orgId', router);
    expect(openModal).toHaveBeenCalled();
  });

  it('normalizes URLs for customer domains', function () {
    ConfigStore.set('customerDomain', {
      subdomain: 'albertos-apples',
      organizationUrl: 'https://albertos-apples.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    navigateTo('/settings/org-slug/projects/', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/projects/');

    router.location.query.project = '2';
    navigateTo('/settings/org-slug/projects/:projectId/alerts/', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/projects/project-slug/alerts/');
  });

  it('preserves query parameters in path object', function () {
    router.location.query.project = '2';
    navigateTo(
      {
        pathname: '/settings/:projectId/alert?project=:project#performance-sidequest',
        query: {referrer: 'onboarding_task'},
      },
      router
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/settings/project-slug/alert?project=2#performance-sidequest',
      query: {referrer: 'onboarding_task'},
    });
  });
});
