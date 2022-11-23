import {useEffect} from 'react';
import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {RouteContext} from 'sentry/views/routeContext';

import {useNavigationControl} from './useNavigationControl';

jest.mock('sentry/actionCreators/modal');

describe('useNavigationControl', () => {
  beforeEach(() => {
    ProjectsStore.init();
    const initialData = initializeOrg();
    ProjectsStore.loadInitialData(initialData.organization.projects);
  });

  afterEach(() => {
    ProjectsStore.reset();
    jest.resetAllMocks();
  });

  it('returns the navigateTo function', function () {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
      </Router>
    );

    expect(typeof navigateTo).toBe('function');
  });
  it('should get project from query parameters', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/:projectId/alert'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=2');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="*" component={() => null} />
      </Router>
    );

    expect(openModal).not.toHaveBeenCalled();
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'pathname',
      '/settings/project-slug/alert'
    );
  });

  it('should get project id from query parameters', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(
        () =>
          navigateTo &&
          navigateTo(
            '/organizations/albertos-apples/performance/?project=:project#performance-sidequest'
          ),
        []
      );
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=2');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="*" component={() => null} />
      </Router>
    );

    expect(openModal).not.toHaveBeenCalled();
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'pathname',
      '/organizations/albertos-apples/performance/'
    );
    expect(memoryHistory.getCurrentLocation()).toHaveProperty('search', '?project=2');
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'hash',
      '#performance-sidequest'
    );
  });

  it('should open modal if the store is somehow missing selected projectId', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/:projectId/alert'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=911');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="/settings/:projectId/alert" component={() => null} />
      </Router>
    );

    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project is selected', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/:projectId/alert'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="/settings/:projectId/alert" component={() => null} />
      </Router>
    );
    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal when no project id is selected', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(
        () =>
          navigateTo &&
          navigateTo(
            '/organizations/albertos-apples/performance/?project=:project#performance-sidequest'
          ),
        []
      );
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="*" component={() => null} />
      </Router>
    );

    expect(openModal).toHaveBeenCalled();
  });

  it('should open modal if more than one project is selected', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/:projectId/alert'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=1&project=2&project=3');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="/settings/:projectId/alert" component={() => null} />
      </Router>
    );
    expect(openModal).toHaveBeenCalled();
  });
  it('should not open modal if url does not require project id', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/alert'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=1');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="/settings/alert" component={() => null} />
      </Router>
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'pathname',
      '/settings/alert'
    );
  });
  it('should open modal for orgId', () => {
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/:orgId'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=1');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="/settings/:orgId" component={() => null} />
      </Router>
    );
    expect(openModal).toHaveBeenCalled();
  });
  it('normalizes URLs for customer domains', function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    } as any;
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(() => navigateTo && navigateTo('/settings/org-slug/projects/'), []);
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="*" component={() => null} />
      </Router>
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'pathname',
      '/settings/projects/'
    );

    // router.location.query.project = '2';
    // navigateTo('/settings/org-slug/projects/:projectId/alerts/', router);
    // expect(openModal).not.toHaveBeenCalled();
    // expect(router.push).toHaveBeenCalledWith('/settings/projects/project-slug/alerts/');
  });
  it('normalizes URLs for customer domains with project slugs', function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    } as any;
    let navigateTo: ReturnType<typeof useNavigationControl> | undefined = undefined;

    function HomePage() {
      navigateTo = useNavigationControl();

      useEffect(
        () => navigateTo && navigateTo('/settings/org-slug/projects/:projectId/alerts/'),
        []
      );
      return null;
    }

    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/?project=2');

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={HomePage} />
        <Route path="*" component={() => null} />
      </Router>
    );
    expect(openModal).not.toHaveBeenCalled();
    expect(memoryHistory.getCurrentLocation()).toHaveProperty(
      'pathname',
      '/settings/projects/project-slug/alerts/'
    );
  });
});
