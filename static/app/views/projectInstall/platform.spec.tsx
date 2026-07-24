import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import * as analytics from 'sentry/utils/analytics';
import {ProjectInstallPlatform} from 'sentry/views/projectInstall/platform';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

type ProjectWithBadPlatform = Omit<Project, 'platform'> & {
  platform: string;
};

function mockProjectApiResponses(projects: Array<Project | ProjectWithBadPlatform>) {
  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/organizations/org-slug/projects/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/docs/other/',
    body: {},
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/rules/',
    body: [],
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    method: 'GET',
    url: '/projects/org-slug/project-slug/overview/',
    body: projects,
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/keys/',
    method: 'GET',
    body: [ProjectKeysFixture()[0]],
  });

  MockApiClient.addMockResponse({
    url: `/projects/org-slug/project-slug/keys/${ProjectKeysFixture()[0].public}/`,
    method: 'PUT',
    body: {},
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/sdks/',
    body: {},
  });
}

function renderAnalyticsScenario(
  projectCreationVariant?: string,
  options: {
    isProjectActive?: boolean;
    mockRecentCreatedProject?: boolean;
  } = {}
) {
  const {organization, project} = initializeOrg({
    router: {params: {projectId: ProjectFixture().slug}},
  });
  const platform: PlatformIntegration = {
    id: 'other',
    name: 'Other',
    link: 'https://docs.sentry.io/platforms/',
    type: 'language',
    language: 'other',
  };
  const projectWithPlatform = {...project, platform: platform.id};
  const routeAnalytics = {
    previousUrl: '',
    setDisableRouteAnalytics: jest.fn(),
    setEventNames: jest.fn(),
    setOrganization: jest.fn(),
    setRouteAnalyticsParams: jest.fn(),
  };

  ProjectsStore.loadInitialData([projectWithPlatform]);
  mockProjectApiResponses([projectWithPlatform]);

  if (options.mockRecentCreatedProject) {
    jest.spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject').mockReturnValue({
      project: projectWithPlatform,
      isProjectActive: options.isProjectActive ?? false,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${projectWithPlatform.slug}/`,
      method: 'DELETE',
      body: {},
    });
  }

  const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
  render(
    <RouteAnalyticsContext value={routeAnalytics}>
      <ProjectInstallPlatform project={projectWithPlatform} platform={platform} />
    </RouteAnalyticsContext>,
    {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`,
          query: {
            product: [ProductSolution.PERFORMANCE_MONITORING],
            ...(projectCreationVariant ? {projectCreationVariant} : {}),
          },
        },
      },
    }
  );

  return {organization, project: projectWithPlatform, routeAnalytics, trackAnalyticsSpy};
}

describe('ProjectInstallPlatform', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render NotFound if no matching integration/platform', async () => {
    const {organization, routerProps, project} = initializeOrg({
      router: {
        params: {
          projectId: ProjectFixture().slug,
        },
      },
    });

    mockProjectApiResponses([{...project, platform: 'lua'}]);

    render(
      <ProjectInstallPlatform {...routerProps} platform={undefined} project={project} />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });

  it('should display info for a non-supported platform', async () => {
    const {organization, routerProps, project} = initializeOrg({
      router: {
        params: {
          projectId: ProjectFixture().slug,
        },
      },
    });

    const platform: PlatformIntegration = {
      id: 'other',
      name: 'Other',
      link: 'https://docs.sentry.io/platforms/',
      type: 'language',
      language: 'other',
    };

    // this is needed because we don't handle a loading state in the UI
    ProjectsStore.loadInitialData([{...project, platform: platform.id}]);

    mockProjectApiResponses([{...project, platform: platform.id}]);

    render(
      <ProjectInstallPlatform {...routerProps} platform={platform} project={project} />,
      {
        organization,
      }
    );

    expect(
      await screen.findByText(/We cannot provide instructions for 'Other' projects/)
    ).toBeInTheDocument();
  });

  it('should not render performance/session replay buttons for errors only self-hosted', async () => {
    const project = ProjectFixture({platform: 'javascript'});

    const {routerProps} = initializeOrg({
      router: {
        params: {
          projectId: project.slug,
        },
      },
    });

    ProjectsStore.loadInitialData([project]);

    mockProjectApiResponses([project]);
    ConfigStore.set('isSelfHostedErrorsOnly', true);

    const platform: PlatformIntegration = {
      id: 'javascript',
      name: 'Browser JavaScript',
      type: 'language',
      language: 'javascript',
      link: 'https://docs.sentry.io/platforms/javascript/',
    };

    render(
      <ProjectInstallPlatform {...routerProps} project={project} platform={platform} />
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Configure Browser JavaScript SDK',
      })
    ).toBeInTheDocument();

    expect(screen.getByText('Take me to Issues')).toBeInTheDocument();
  });

  it.each(['scm', 'legacy'] as const)(
    'attributes getting-started analytics to the %s project-creation variant',
    async variant => {
      const {organization, project, routeAnalytics, trackAnalyticsSpy} =
        renderAnalyticsScenario(variant);

      expect(routeAnalytics.setEventNames).toHaveBeenCalledWith(
        'project_creation.getting_started_viewed',
        'Project Creation: Getting Started Viewed'
      );
      expect(routeAnalytics.setRouteAnalyticsParams).toHaveBeenCalledWith({
        platform: 'Other',
        products: [ProductSolution.PERFORMANCE_MONITORING],
        project_id: project.id,
        variant,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Take me to Issues'}));

      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.take_me_to_issues_clicked',
        {
          organization,
          platform: 'Other',
          products: [ProductSolution.PERFORMANCE_MONITORING],
          project_id: project.id,
          variant,
        }
      );
      expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
        'onboarding.take_me_to_issues_clicked',
        expect.anything()
      );
    }
  );

  it('keeps unmarked getting-started clicks in the onboarding counter', async () => {
    const {organization, project, routeAnalytics, trackAnalyticsSpy} =
      renderAnalyticsScenario();

    expect(routeAnalytics.setEventNames).not.toHaveBeenCalled();
    expect(routeAnalytics.setRouteAnalyticsParams).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Take me to Issues'}));

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.take_me_to_issues_clicked',
      {
        organization,
        platform: 'Other',
        products: [ProductSolution.PERFORMANCE_MONITORING],
        project_id: project.id,
      }
    );
    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'project_creation.take_me_to_issues_clicked',
      expect.anything()
    );
  });

  it.each(['scm', 'legacy'] as const)(
    'attributes getting-started header back analytics to the %s variant',
    async variant => {
      const {organization, project, trackAnalyticsSpy} = renderAnalyticsScenario(
        variant,
        {mockRecentCreatedProject: true, isProjectActive: false}
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Back to Platform Selection'})
      );

      await waitFor(() => {
        expect(trackAnalyticsSpy).toHaveBeenCalledWith(
          'project_creation.back_button_clicked',
          expect.objectContaining({organization, variant})
        );
      });
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.data_removal_modal_confirm_button_clicked',
        expect.objectContaining({
          organization,
          platform: project.slug,
          project_id: project.id,
          variant,
        })
      );
      await waitFor(() => {
        expect(trackAnalyticsSpy).toHaveBeenCalledWith(
          'project_creation.data_removed',
          expect.objectContaining({
            organization,
            date_created: project.dateCreated,
            platform: project.slug,
            project_id: project.id,
            variant,
          })
        );
      });
    }
  );

  it('fires header back analytics without a guessed variant when unmarked', async () => {
    const {organization, project, trackAnalyticsSpy} = renderAnalyticsScenario(
      undefined,
      {mockRecentCreatedProject: true, isProjectActive: false}
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Back to Platform Selection'})
    );

    await waitFor(() => {
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.back_button_clicked',
        expect.objectContaining({organization})
      );
    });
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.back_button_clicked',
      expect.not.objectContaining({variant: expect.anything()})
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.data_removal_modal_confirm_button_clicked',
      expect.objectContaining({
        organization,
        platform: project.slug,
        project_id: project.id,
      })
    );
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.data_removal_modal_confirm_button_clicked',
      expect.not.objectContaining({variant: expect.anything()})
    );
    await waitFor(() => {
      expect(trackAnalyticsSpy).toHaveBeenCalledWith(
        'project_creation.data_removed',
        expect.objectContaining({
          organization,
          date_created: project.dateCreated,
          platform: project.slug,
          project_id: project.id,
        })
      );
    });
    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.data_removed',
      expect.not.objectContaining({variant: expect.anything()})
    );
  });
});
