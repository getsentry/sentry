import {browserHistory} from 'react-router';
import type {Location} from 'history';
import {ReplayConsoleFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';
import {useLocation} from 'sentry/utils/useLocation';
import useConsoleFilters, {
  FilterFields,
} from 'sentry/views/replays/detail/console/useConsoleFilters';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);
const mockRRWebFrames = []; // This is only needed for replay.hydrate-error breadcrumbs.

const frames = hydrateBreadcrumbs(
  ReplayRecordFixture(),
  [
    ReplayConsoleFrameFixture({
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date('2022-05-11T23:00:45.094000Z'),
      level: BreadcrumbLevelType.INFO,
      message: 'longtask - does not exist [object PerformanceLongTaskTiming]',
      data: {
        arguments: [
          'longtask - does not exist',
          {
            attribution: ['[object TaskAttributionTiming]'],
            duration: 76,
            entryType: 'longtask',
            name: 'self',
            startTime: 3741,
          },
        ],
        logger: 'console',
      },
    }),
    ReplayConsoleFrameFixture({
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date('2022-05-11T23:00:45.094000Z'),
      level: BreadcrumbLevelType.INFO,
      message: 'longtask - does not exist [object PerformanceLongTaskTiming]',
    }),
    ReplayConsoleFrameFixture({
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date('2022-05-11T23:00:45.093000Z'),
      level: BreadcrumbLevelType.INFO,
      message: 'event - does not exist [object PerformanceEventTiming]',
      data: {
        arguments: [
          'event - does not exist',
          {
            cancelable: true,
            duration: 160,
            entryType: 'event',
            name: 'keyup',
            processingEnd: 505,
            processingStart: 505,
            startTime: 347.90000009536743,
          },
        ],
        logger: 'console',
      },
    }),
    ReplayConsoleFrameFixture({
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date('2022-05-11T23:04:27.576000Z'),
      level: BreadcrumbLevelType.ERROR,
      message:
        'The above error occurred in the <TestButton> component:\n\n    at TestButton (webpack-internal:///./app/views/userFeedback/index.tsx:224:76)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ButtonBar (webpack-internal:///./app/components/buttonBar.tsx:30:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at NoProjectMessage (webpack-internal:///./app/components/noProjectMessage.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at Container (webpack-internal:///./app/components/organizations/pageFilters/container.tsx:66:5)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationUserFeedback (webpack-internal:///./app/views/userFeedback/index.tsx:73:1)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationUserFeedback)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at LazyLoad (webpack-internal:///./app/components/lazyLoad.tsx:39:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at OrganizationDetailsBody (webpack-internal:///./app/views/organizationDetails/body.tsx:131:5)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at div\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationContextContainer (webpack-internal:///./app/views/organizationContextContainer.tsx:157:5)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationContextContainer)\n    at WithOrganizations (webpack-internal:///./app/utils/withOrganizations.tsx:27:7)\n    at WithApi (webpack-internal:///./app/utils/withApi.tsx:35:12)\n    at OrganizationDetails (webpack-internal:///./app/views/organizationDetails/index.tsx:27:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at App (webpack-internal:///./app/views/app/index.tsx:72:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at PersistedStoreProvider (webpack-internal:///./app/stores/persistedStore.tsx:59:76)\n    at ThemeProvider (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:79:64)\n    at ThemeAndStyleProvider (webpack-internal:///./app/components/themeAndStyleProvider.tsx:45:5)\n    at Main\n\nReact will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.',
      data: {
        arguments: [
          'The above error occurred in the <TestButton> component:\n\n    at TestButton (webpack-internal:///./app/views/userFeedback/index.tsx:224:76)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ButtonBar (webpack-internal:///./app/components/buttonBar.tsx:30:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at NoProjectMessage (webpack-internal:///./app/components/noProjectMessage.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at Container (webpack-internal:///./app/components/organizations/pageFilters/container.tsx:66:5)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationUserFeedback (webpack-internal:///./app/views/userFeedback/index.tsx:73:1)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationUserFeedback)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at LazyLoad (webpack-internal:///./app/components/lazyLoad.tsx:39:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at OrganizationDetailsBody (webpack-internal:///./app/views/organizationDetails/body.tsx:131:5)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at div\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/...',
        ],
        logger: '',
      },
    }),
    ReplayConsoleFrameFixture({
      type: BreadcrumbType.DEFAULT,
      timestamp: new Date('2022-05-11T23:05:51.531000Z'),
      level: BreadcrumbLevelType.WARNING,
      message:
        'Warning: componentWillMount has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s Router, RouterContext',
      data: {
        arguments: [
          'Warning: componentWillMount has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s',
          'Router, RouterContext',
          'find me',
        ],
        logger: 'console',
      },
    }),
  ],
  mockRRWebFrames
);

describe('useConsoleFilters', () => {
  beforeEach(() => {
    jest.mocked(browserHistory.replace).mockReset();
  });

  it('should update the url when setters are called', () => {
    const LOG_FILTER = ['error'];
    const SEARCH_FILTER = 'component';

    mockUseLocation
      .mockReturnValueOnce({
        pathname: '/',
        query: {},
      } as Location<FilterFields>)
      .mockReturnValueOnce({
        pathname: '/',
        query: {f_c_logLevel: LOG_FILTER},
      } as Location<FilterFields>);

    const {result, rerender} = reactHooks.renderHook(useConsoleFilters, {
      initialProps: {frames},
    });

    result.current.setLogLevel(LOG_FILTER);
    expect(browserHistory.replace).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_c_logLevel: LOG_FILTER,
      },
    });

    rerender();

    result.current.setSearchTerm(SEARCH_FILTER);
    expect(browserHistory.replace).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {
        f_c_logLevel: LOG_FILTER,
        f_c_search: SEARCH_FILTER,
      },
    });
  });

  it('should not filter anything when no values are set', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {},
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useConsoleFilters, {
      initialProps: {frames},
    });
    expect(result.current.items.length).toEqual(5);
  });

  it('should filter by logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_c_logLevel: ['error', 'warning'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useConsoleFilters, {
      initialProps: {frames},
    });
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by searchTerm', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_c_search: 'component',
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useConsoleFilters, {
      initialProps: {frames},
    });
    expect(result.current.items.length).toEqual(2);
  });

  it('should filter by searchTerm and logLevel', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/',
      query: {
        f_c_search: 'error occurred',
        f_c_logLevel: ['error'],
      },
    } as Location<FilterFields>);

    const {result} = reactHooks.renderHook(useConsoleFilters, {
      initialProps: {frames},
    });
    expect(result.current.items.length).toEqual(1);
  });

  describe('getOptions', () => {
    const [CRUMB_LOG_1, CRUMB_LOG_2, CRUMB_WARN, CRUMB_ERROR] = hydrateBreadcrumbs(
      ReplayRecordFixture(),
      [
        ReplayConsoleFrameFixture({
          timestamp: new Date(),
          level: BreadcrumbLevelType.LOG,
          message: '',
        }),
        ReplayConsoleFrameFixture({
          timestamp: new Date(),
          level: BreadcrumbLevelType.LOG,
          message: '',
        }),
        ReplayConsoleFrameFixture({
          timestamp: new Date(),
          level: BreadcrumbLevelType.WARNING,
          message: '',
        }),
        ReplayConsoleFrameFixture({
          timestamp: new Date(),
          level: BreadcrumbLevelType.ERROR,
          message: '',
        }),
      ],
      mockRRWebFrames
    );

    // const CRUMB_LOG_1 = {level: BreadcrumbLevelType.LOG, message: ''} as Crumb;
    // const CRUMB_LOG_2 = {level: BreadcrumbLevelType.LOG, message: ''} as Crumb;
    // const CRUMB_WARN = {level: BreadcrumbLevelType.WARNING, message: ''} as Crumb;
    // const CRUMB_ERROR = {level: BreadcrumbLevelType.ERROR, message: ''} as Crumb;
    // const CRUMB_ISSUE = {category: 'issue', level: 'error', message: ''} as Crumb;

    beforeEach(() => {
      mockUseLocation.mockReturnValue({
        pathname: '/',
        query: {},
      } as Location<FilterFields>);
    });

    it('should return a sorted list of BreadcrumbLevelType', () => {
      const simpleCrumbs = [CRUMB_LOG_1, CRUMB_WARN, CRUMB_ERROR];

      const {result} = reactHooks.renderHook(useConsoleFilters, {
        initialProps: {frames: simpleCrumbs},
      });
      expect(result.current.getLogLevels()).toStrictEqual([
        {label: 'error', value: 'error'},
        {label: 'warning', value: 'warning'},
        {label: 'log', value: 'log'},
      ]);
    });

    it('should deduplicate BreadcrumbLevelType', () => {
      const simpleCrumbs = [CRUMB_LOG_1, CRUMB_LOG_2];

      const {result} = reactHooks.renderHook(useConsoleFilters, {
        initialProps: {frames: simpleCrumbs},
      });
      expect(result.current.getLogLevels()).toStrictEqual([{label: 'log', value: 'log'}]);
    });

    it('should inject extra BreadcrumbLevelType values', () => {
      const simpleCrumbs = [CRUMB_WARN, CRUMB_ERROR];

      mockUseLocation.mockReturnValue({
        pathname: '/',
        query: {f_c_logLevel: ['log']},
      } as Location<FilterFields>);

      const {result} = reactHooks.renderHook(useConsoleFilters, {
        initialProps: {frames: simpleCrumbs},
      });

      expect(result.current.getLogLevels()).toStrictEqual([
        {label: 'error', value: 'error'},
        {label: 'warning', value: 'warning'},
        {label: 'log', value: 'log'},
      ]);
    });

    // it('should include issue if a crumb has that for a category', () => {
    //   const simpleCrumbs = [CRUMB_ISSUE];

    //   const {result} = reactHooks.renderHook(useConsoleFilters, {
    //     initialProps: {breadcrumbs: simpleCrumbs},
    //   });
    //   expect(result.current.getLogLevels()).toStrictEqual([
    //     {label: 'sentry error', value: 'issue'},
    //   ]);
    // });

    // it('should include issue the query includes it', () => {
    //   const simpleCrumbs = [];
    //   mockUseLocation.mockReturnValue({
    //     pathname: '/',
    //     query: {f_c_logLevel: ['issue']},
    //   } as Location<FilterFields>);

    //   const {result} = reactHooks.renderHook(useConsoleFilters, {
    //     initialProps: {frames: simpleCrumbs},
    //   });

    //   expect(result.current.getLogLevels()).toStrictEqual([
    //     {label: 'sentry error', value: 'issue'},
    //   ]);
    // });
  });
});
