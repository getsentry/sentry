import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectUserFeedback from 'sentry/views/settings/projectUserFeedback';

describe('ProjectUserFeedback', () => {
  const {organization} = initializeOrg();
  const project = DetailedProjectFixture({
    options: {
      'feedback:branding': false,
      'sentry:feedback_user_report_notifications': false,
      'sentry:feedback_ai_spam_detection': false,
    },
  });
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
    MockApiClient.addMockResponse({
      url,
      body: project,
    });
    seerSetupMock = mockSeerSetup();
  });

  it('can toggle sentry branding option', async () => {
    const updatedProject = DetailedProjectFixture({
      ...project,
      options: {
        ...project.options,
        'feedback:branding': true,
      },
    });
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: updatedProject,
    });
    MockApiClient.addMockResponse({
      url,
      body: updatedProject,
    });

    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Sentry Branding in Crash Report Modal',
    });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'feedback:branding': true},
        },
      })
    );

    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
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
    const updatedProject = DetailedProjectFixture({
      ...project,
      options: {
        ...project.options,
        'sentry:feedback_user_report_notifications': true,
      },
    });
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      body: updatedProject,
    });
    MockApiClient.addMockResponse({
      url,
      body: updatedProject,
    });

    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Enable Crash Report Notifications',
    });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:feedback_user_report_notifications': true},
        },
      })
    );

    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
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

  it('keeps spam detection toggled after autosave resets', async () => {
    organization.features.push('user-feedback-spam-ingest');
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup();

    const updatedProject = DetailedProjectFixture({
      ...project,
      options: {
        ...project.options,
        'sentry:feedback_ai_spam_detection': true,
      },
    });
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
      // Delay so AutoSaveForm has time to reset after the mutation settles.
      asyncDelay: 100,
      body: updatedProject,
    });
    MockApiClient.addMockResponse({
      url,
      body: updatedProject,
    });

    render(<ProjectUserFeedback />, {
      organization,
      outletContext: {project},
    });

    await waitFor(() => {
      expect(seerSetupMock).toHaveBeenCalled();
    });

    const checkbox = await screen.findByRole('checkbox', {name: 'Enable Spam Detection'});
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:feedback_ai_spam_detection': true},
        },
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('status', {name: 'Saving sentry:feedback_ai_spam_detection'})
      ).not.toBeInTheDocument();
    });
    expect(checkbox).toBeChecked();
  });
});
