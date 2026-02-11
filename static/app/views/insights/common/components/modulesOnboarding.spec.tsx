import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import {ModuleName} from 'sentry/views/insights/types';

import {ModulesOnboarding} from './modulesOnboarding';

jest.mock('sentry/components/pageFilters/usePageFilters');

describe('ModulesOnboarding', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders children correctly', () => {
    const project = ProjectFixture({hasInsightsCaches: true});
    project.firstTransactionEvent = true;
    project.hasInsightsCaches = true;

    ProjectsStore.loadInitialData([project]);

    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

    render(
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    screen.getByText('Module Content');
  });

  it('renders onboarding content correctly', async () => {
    const project = ProjectFixture();
    project.firstTransactionEvent = true;
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          datetime: {
            period: '10d',
            start: null,
            end: null,
            utc: false,
          },
          environments: [],
          projects: [Number(project.id)],
        },
      })
    );

    render(
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.findByText('Bringing you one less hard problem in computer science');
  });

  it('renders performance onboarding if onboardingProject', async () => {
    const project = ProjectFixture();
    project.hasInsightsCaches = true;
    ProjectsStore.loadInitialData([project]);

    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          datetime: {
            period: '10d',
            start: null,
            end: null,
            utc: false,
          },
          environments: [],
          projects: [Number(project.id)],
        },
      })
    );

    render(
      <ModulesOnboarding moduleName={ModuleName.CACHE}>
        <div>Module Content</div>
      </ModulesOnboarding>
    );

    await screen.findByText('Pinpoint problems');
  });
});
