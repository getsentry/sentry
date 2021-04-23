import {initializeOrg} from 'sentry-test/initializeOrg';

import {openModal} from 'app/actionCreators/modal';
import {navigateTo} from 'app/actionCreators/navigation';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('app/actionCreators/modal');

describe('navigation ActionCreator', () => {
  let router;
  beforeEach(() => {
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
    expect(navigateTo('/settings/:projectId/alert', router)).toBe();
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/project-slug/alert');
  });

  it('should open modal if the store is somehow missing selected projectId', () => {
    router.location.query.project = '911';
    expect(navigateTo('/settings/:projectId/alert', router)).toBe();
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project is selected', () => {
    expect(navigateTo('/settings/:projectId/alert', router)).toBe();
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal if more than one project is selected', () => {
    router.location.query.project = ['1', '2', '3'];
    expect(navigateTo('/settings/:projectId/alert', router)).toBe();
    expect(openModal).toHaveBeenCalled();
  });

  it('should not open modal if url does not require project id', () => {
    expect(navigateTo('/settings/alert', router)).toBe();
    expect(openModal).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings/alert');
  });

  it('should open modal for orgId', () => {
    expect(navigateTo('/settings/:orgId', router)).toBe();
    expect(openModal).toHaveBeenCalled();
  });
});
