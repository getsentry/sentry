import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ModuleName} from 'sentry/views/insights/types';

import {ModulesOnboarding} from './modulesOnboarding';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useOnboardingProject');

describe('ModulesOnboarding', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders children correctly', () => {
    const project = ProjectFixture({hasInsightsCaches: true});
    project.firstTransactionEvent = true;
    project.hasInsightsCaches = true;

    jest.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    jest.mocked(useOnboardingProject).mockReturnValue(undefined);

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
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    screen.getByText('Module Content');
  });

  it('renders onboarding content correctly', async () => {
    const project = ProjectFixture();
    jest.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
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
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.findByText('Bringing you one less hard problem in computer science');
  });

  it('renders performance onboarding if onboardingProject', async () => {
    const project = ProjectFixture();
    jest.mocked(useOnboardingProject).mockReturnValue(project);
    jest.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
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
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.findByText('Pinpoint problems');
  });
});
