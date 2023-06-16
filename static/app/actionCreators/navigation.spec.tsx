import {InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {openModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import ProjectsStore from 'sentry/stores/projectsStore';

jest.mock('sentry/actionCreators/modal');

describe('navigation ActionCreator', () => {
  let router: InjectedRouter;

  beforeEach(() => {
    ProjectsStore.init();
    const initialData = initializeOrg({
      router: {
        location: {query: {}, search: ''},
        push: jest.fn(),
      },
    });
    router = initialData.router;
    ProjectsStore.loadInitialData(initialData.organization.projects);
  });

  afterEach(() => {
    ProjectsStore.reset();
    jest.resetAllMocks();
  });

  it('should get project from query parameters', () => {
    router.location.query.project = '2';
    expect(navigateTo('/settings/:projectId/alert', router)).toBe(undefined);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/project-slug/alert');
  });

  it('should get project id from query parameters', () => {
    router.location.query.project = '2';
    expect(
      navigateTo(
        '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
        router
      )
    ).toBe(undefined);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/albertos-apples/performance/?project=2#performance-sidequest'
    );
  });

  it('should get project and project id from query parameters', () => {
    router.location.query.project = '2';
    expect(
      navigateTo(
        '/settings/:projectId/alert?project=:project#performance-sidequest',
        router
      )
    ).toBe(undefined);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/settings/project-slug/alert?project=2#performance-sidequest'
    );
  });

  it('should open modal if the store is somehow missing selected projectId', () => {
    router.location.query.project = '911';
    expect(navigateTo('/settings/:projectId/alert', router)).toBe(undefined);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project is selected', () => {
    expect(navigateTo('/settings/:projectId/alert', router)).toBe(undefined);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project id is selected', () => {
    expect(
      navigateTo(
        '/organizations/albertos-apples/performance/?project=:project#performance-sidequest',
        router
      )
    ).toBe(undefined);
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal if more than one project is selected', () => {
    router.location.query.project = ['1', '2', '3'];
    expect(navigateTo('/settings/:projectId/alert', router)).toBe(undefined);
    expect(openModal).toHaveBeenCalled();
  });

  it('should not open modal if url does not require project id', () => {
    expect(navigateTo('/settings/alert', router)).toBe(undefined);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/alert');
  });

  it('should open modal for orgId', () => {
    expect(navigateTo('/settings/:orgId', router)).toBe(undefined);
    expect(openModal).toHaveBeenCalled();
  });

  it('normalizes URLs for customer domains', function () {
    window.__initialData = {
      ...window.__initialData,
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    };
    navigateTo('/settings/org-slug/projects/', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/projects/');

    router.location.query.project = '2';
    navigateTo('/settings/org-slug/projects/:projectId/alerts/', router);
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/projects/project-slug/alerts/');
  });
});
