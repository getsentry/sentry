import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {ModuleName} from 'sentry/views/insights/types';

import {ModulesOnboarding} from './modulesOnboarding';

vi.mock('sentry/utils/useProjects');
vi.mock('sentry/utils/usePageFilters');
vi.mock('sentry/views/insights/common/queries/useOnboardingProject');

describe('ModulesOnboarding', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders children correctly', () => {
    const project = ProjectFixture({hasInsightsCaches: true});
    project.firstTransactionEvent = true;
    project.hasInsightsCaches = true;

    vi.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: vi.fn(),
      reloadProjects: vi.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    vi.mocked(useOnboardingProject).mockReturnValue(undefined);

    vi.mocked(usePageFilters).mockReturnValue({
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
    vi.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: vi.fn(),
      reloadProjects: vi.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    vi.mocked(usePageFilters).mockReturnValue({
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
    vi.mocked(useOnboardingProject).mockReturnValue(project);
    vi.mocked(useProjects).mockReturnValue({
      projects: [project],
      onSearch: vi.fn(),
      reloadProjects: vi.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    vi.mocked(usePageFilters).mockReturnValue({
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
