import {filterBreadcrumbs} from 'sentry/views/replays/detail/console/utils';

const breadcrumbs = [
  {
    type: 'default',
    timestamp: '2022-05-11T23:00:45.094000Z',
    level: 'info',
    message: 'longtask - does not exist [object PerformanceLongTaskTiming]',
    category: 'console',
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
    event_id: null,
  },
  {
    type: 'default',
    timestamp: '2022-05-11T23:00:45.093000Z',
    level: 'info',
    message: 'event - does not exist [object PerformanceEventTiming]',
    category: 'console',
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
    event_id: null,
  },
  {
    type: 'default',
    timestamp: '2022-05-11T23:04:27.576000Z',
    level: 'error',
    message:
      'The above error occurred in the <TestButton> component:\n\n    at TestButton (webpack-internal:///./app/views/userFeedback/index.tsx:224:76)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ButtonBar (webpack-internal:///./app/components/buttonBar.tsx:30:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at NoProjectMessage (webpack-internal:///./app/components/noProjectMessage.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at Container (webpack-internal:///./app/components/organizations/pageFilters/container.tsx:66:5)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationUserFeedback (webpack-internal:///./app/views/userFeedback/index.tsx:73:1)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationUserFeedback)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at LazyLoad (webpack-internal:///./app/components/lazyLoad.tsx:39:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at OrganizationDetailsBody (webpack-internal:///./app/views/organizationDetails/body.tsx:131:5)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at div\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationContextContainer (webpack-internal:///./app/views/organizationContextContainer.tsx:157:5)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationContextContainer)\n    at WithOrganizations (webpack-internal:///./app/utils/withOrganizations.tsx:27:7)\n    at WithApi (webpack-internal:///./app/utils/withApi.tsx:35:12)\n    at OrganizationDetails (webpack-internal:///./app/views/organizationDetails/index.tsx:27:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at App (webpack-internal:///./app/views/app/index.tsx:72:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at PersistedStoreProvider (webpack-internal:///./app/stores/persistedStore.tsx:59:76)\n    at ThemeProvider (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:79:64)\n    at ThemeAndStyleProvider (webpack-internal:///./app/components/themeAndStyleProvider.tsx:45:5)\n    at Main\n\nReact will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.',
    category: 'console',
    data: {
      arguments: [
        'The above error occurred in the <TestButton> component:\n\n    at TestButton (webpack-internal:///./app/views/userFeedback/index.tsx:224:76)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ButtonBar (webpack-internal:///./app/components/buttonBar.tsx:30:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at div\n    at NoProjectMessage (webpack-internal:///./app/components/noProjectMessage.tsx:45:5)\n    at div\n    at eval (webpack-internal:///../node_modules/@emotion/react/dist/emotion-element-a8309070.browser.esm.js:45:66)\n    at Container (webpack-internal:///./app/components/organizations/pageFilters/container.tsx:66:5)\n    at eval (webpack-internal:///../node_modules/create-react-class/factory.js:821:37)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/react-side-effect/lib/index.js:74:27)\n    at SentryDocumentTitle (webpack-internal:///./app/components/sentryDocumentTitle.tsx:22:5)\n    at OrganizationUserFeedback (webpack-internal:///./app/views/userFeedback/index.tsx:73:1)\n    at Profiler (webpack-internal:///../node_modules/@sentry/react/esm/profiler.js:83:28)\n    at profiler(OrganizationUserFeedback)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at LazyLoad (webpack-internal:///./app/components/lazyLoad.tsx:39:5)\n    at ErrorHandler (webpack-internal:///./app/utils/errorHandler.tsx:24:7)\n    at ErrorBoundary (webpack-internal:///./app/components/errorBoundary.tsx:45:5)\n    at OrganizationDetailsBody (webpack-internal:///./app/views/organizationDetails/body.tsx:131:5)\n    at _class (webpack-internal:///./app/utils/withOrganization.tsx:24:19)\n    at div\n    at DocumentTitle\n    at SideEffect (webpack-internal:///../node_modules/...',
      ],
    },
    event_id: null,
  },
  {
    type: 'default',
    timestamp: '2022-05-11T23:05:51.531000Z',
    level: 'warning',
    message:
      'Warning: componentWillMount has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s Router, RouterContext',
    category: 'console',
    data: {
      arguments: [
        'Warning: componentWillMount has been renamed, and is not recommended for use. See https://reactjs.org/link/unsafe-component-lifecycles for details.\n\n* Move code with side effects to componentDidMount, and set initial state in the constructor.\n* Rename componentWillMount to UNSAFE_componentWillMount to suppress this warning in non-strict mode. In React 18.x, only the UNSAFE_ name will work. To rename all deprecated lifecycles to their new names, you can run `npx react-codemod rename-unsafe-lifecycles` in your project source folder.\n\nPlease update the following components: %s',
        'Router, RouterContext',
        'find me',
      ],
      logger: 'console',
    },
    event_id: null,
  },
];

describe('replays/details/console', () => {
  it('filters console breadcrumbs by log level', () => {
    const result = filterBreadcrumbs(breadcrumbs, '', ['error', 'warning']);
    expect(result.length).toEqual(2);
  });

  it('filters console breadcrumbs by search term', () => {
    const result = filterBreadcrumbs(breadcrumbs, 'comp', []);
    expect(result.length).toEqual(2);
  });

  it('filters console breadcrumbs by search term where match is within data.arguments', () => {
    const result = filterBreadcrumbs(breadcrumbs, 'find me', []);
    expect(result.length).toEqual(1);
  });

  it('filters console breadcrumbs by search term and log level', () => {
    const result = filterBreadcrumbs(breadcrumbs, 'tEs', ['error']);
    expect(result.length).toEqual(1);
  });

  it('does not filter if no searchTerm or logLevel filters are present', () => {
    const result = filterBreadcrumbs(breadcrumbs, '', []);
    expect(result.length).toEqual(4);
  });
});
