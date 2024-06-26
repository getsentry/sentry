import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {ModuleName} from 'sentry/views/insights/types';

import {ModulesOnboarding} from './modulesOnboarding';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/usePageFilters');

describe('ModulesOnboarding', () => {
  beforeEach(function () {});

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders children correctly', async () => {
    const project = ProjectFixture();
    project.firstTransactionEvent = true;
    project.hasInsightsCaches = true;

    jest.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });

    render(
      <ModulesOnboarding
        moduleName={ModuleName.CACHE}
        onboardingContent={<div>Start collecting Insights!</div>}
      >
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.getByText('Module Content');
  });

  it('renders onboarding content correctly', async () => {
    const project = ProjectFixture();
    jest.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });

    render(
      <ModulesOnboarding
        moduleName={ModuleName.CACHE}
        onboardingContent={<div>Start collecting Insights!</div>}
      >
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.findByText('Start collecting Insights!');
  });
});
