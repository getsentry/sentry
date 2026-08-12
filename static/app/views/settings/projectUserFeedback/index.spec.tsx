import {Outlet} from 'react-router-dom';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import ProjectUserFeedback from 'sentry/views/settings/projectUserFeedback';

describe('ProjectUserFeedback', () => {
  const {project, organization} = initializeOrg();
  const url = `/projects/${organization.slug}/${project.slug}/`;
  let seerSetupMock: any;

  const mockSeerSetup = () => {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: {
        billing: {
          hasAutofixQuota: false,
          hasScannerQuota: false,
        },
      },
    });
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `${url}keys/`,
      method: 'GET',
      body: [],
    });
    seerSetupMock = mockSeerSetup();
  });

  it('can toggle sentry branding option', async () => {
    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Show Sentry Branding in Crash Report Modal'})
    );

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'feedback:branding': true},
        },
      })
    );
  });

  it('renders all fields with correct labels', () => {
    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    expect(
      screen.getByRole('checkbox', {name: 'Show Sentry Branding in Crash Report Modal'})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('checkbox', {name: 'Enable Crash Report Notifications'})
    ).toBeInTheDocument();
  });

  it('can toggle crash report notifications', async () => {
    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Enable Crash Report Notifications'})
    );

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:feedback_user_report_notifications': true},
        },
      })
    );
  });

  it('cannot toggle spam detection when the user does not have the spam feature flag', () => {
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup();

    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    expect(
      screen.queryByRole('checkbox', {name: 'Enable Spam Detection'})
    ).not.toBeInTheDocument();
  });

  it('can toggle spam detection', async () => {
    organization.features.push('user-feedback-spam-ingest');
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup();

    const detailedProject = DetailedProjectFixture(project);
    let savedProject = detailedProject;
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: () => savedProject,
    });

    const update = Promise.withResolvers<typeof detailedProject>();
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: () => update.promise,
    });

    function TestRoute() {
      const {data: currentProject} = useDetailedProject({
        orgSlug: organization.slug,
        projectSlug: detailedProject.slug,
      });

      return currentProject ? <Outlet context={{project: currentProject}} /> : null;
    }

    render(<TestRoute />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/'},
        route: '/',
        children: [{index: true, element: <ProjectUserFeedback />}],
      },
    });

    await waitFor(() => {
      expect(seerSetupMock).toHaveBeenCalled();
    });

    const checkbox = await screen.findByRole('checkbox', {name: 'Enable Spam Detection'});

    await userEvent.click(checkbox);

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:feedback_ai_spam_detection': true},
        },
      })
    );
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    savedProject = {
      ...detailedProject,
      options: {
        ...detailedProject.options,
        'sentry:feedback_ai_spam_detection': true,
      },
    };
    update.resolve(savedProject);

    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).toBeChecked();
  });
});
