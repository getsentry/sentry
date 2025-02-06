import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectCspReports from 'sentry/views/settings/projectSecurityHeaders/csp';

describe('ProjectCspReports', function () {
  const {project, organization} = initializeOrg();

  const projectUrl = `/projects/${organization.slug}/${project.slug}/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'GET',
      body: {
        options: {},
      },
    });
  });

  it('renders', async function () {
    render(<ProjectCspReports />, {
      organization,
    });

    // Renders the loading indication initially
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Heading
    expect(
      await screen.findByText('Content Security Policy', {selector: 'h1'})
    ).toBeInTheDocument();
  });

  it('renders loading error', async function () {
    MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'GET',
      statusCode: 400,
      body: {},
    });
    render(<ProjectCspReports />, {
      organization,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('can enable default ignored sources', async function () {
    render(<ProjectCspReports />, {
      organization,
    });

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Use default ignored sources'})
    );

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {
            'sentry:csp_ignored_sources_defaults': true,
          },
        },
      })
    );
  });

  it('can set additional ignored sources', async function () {
    render(<ProjectCspReports />, {
      organization,
    });

    const mock = MockApiClient.addMockResponse({
      url: projectUrl,
      method: 'PUT',
    });

    expect(mock).not.toHaveBeenCalled();

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Additional ignored sources'}),
      'test\ntest2'
    );

    // Focus on other element, trigerring onBlur
    await userEvent.tab();

    expect(mock).toHaveBeenCalledWith(
      projectUrl,
      expect.objectContaining({
        method: 'PUT',
        data: {
          // XXX: Org details endpoints accept these multiline inputs as a list, where as it looks like project details accepts it as a string with newlines
          options: {
            'sentry:csp_ignored_sources': `test\ntest2`,
          },
        },
      })
    );
  });
});
