import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';
import ProjectUserFeedback from 'sentry/views/settings/projectUserFeedback';

jest.mock('sentry/utils/useParams', () => ({
  useParams: jest.fn(),
}));

describe('ProjectUserFeedback', () => {
  const {project, organization} = initializeOrg();
  const url = `/projects/${organization.slug}/${project.id}/`;
  let seerSetupMock: any;

  const mockSeerSetup = (overrides: any = {}) => {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: {
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
          ...overrides.setupAcknowledgement,
        },
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
      url,
      method: 'GET',
      body: ProjectFixture(),
    });
    MockApiClient.addMockResponse({
      url: `${url}keys/`,
      method: 'GET',
      body: [],
    });
    seerSetupMock = mockSeerSetup();
  });

  it('can toggle sentry branding option', async () => {
    jest.mocked(useParams).mockReturnValue({
      projectId: project.id,
    });

    render(<ProjectUserFeedback project={project} />, {organization});

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

  it('cannot toggle spam detection when the user does not have the spam feature flag', () => {
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup({setupAcknowledgement: {orgHasAcknowledged: true}});

    render(<ProjectUserFeedback project={project} />, {organization});

    expect(
      screen.queryByRole('checkbox', {name: 'Enable Spam Detection'})
    ).not.toBeInTheDocument();
  });

  it('cannot toggle spam detection when the user does not have ai features', () => {
    organization.features.push('user-feedback-spam-ingest');
    seerSetupMock = mockSeerSetup({setupAcknowledgement: {orgHasAcknowledged: false}});

    render(<ProjectUserFeedback project={project} />, {organization});

    expect(
      screen.queryByRole('checkbox', {name: 'Enable Spam Detection'})
    ).not.toBeInTheDocument();
  });

  it('cannot toggle spam detection when the user does not seer acknowledged', () => {
    organization.features.push('user-feedback-spam-ingest');
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup({setupAcknowledgement: {orgHasAcknowledged: false}});

    render(<ProjectUserFeedback project={project} />, {organization});

    expect(
      screen.queryByRole('checkbox', {name: 'Enable Spam Detection'})
    ).not.toBeInTheDocument();
  });

  it('can toggle spam detection', async () => {
    organization.features.push('user-feedback-spam-ingest');
    organization.features.push('gen-ai-features');
    seerSetupMock = mockSeerSetup({setupAcknowledgement: {orgHasAcknowledged: true}});

    render(<ProjectUserFeedback project={project} />, {organization});

    await waitFor(() => {
      expect(seerSetupMock).toHaveBeenCalled();
    });

    const checkbox = await screen.findByRole('checkbox', {name: 'Enable Spam Detection'});

    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

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
  });
});
