import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {TracingEmptyState} from './tracingEmptyState';

describe('TracingEmptyState', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/keys/',
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdks/',
      method: 'GET',
    });

    PageFiltersStore.init();
  });

  it('renders intro title and benefits', async () => {
    const project = ProjectFixture({platform: 'javascript-react'});

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: project,
    });

    render(<TracingEmptyState organization={organization} project={project} />);

    expect(await screen.findByText('Tracing in Sentry')).toBeInTheDocument();
    expect(
      screen.getByText('Inspect model calls and tool calls in AI agents')
    ).toBeInTheDocument();
  });

  it('shows the "Set up manually" tab with doc steps', async () => {
    const project = ProjectFixture({platform: 'javascript-react'});

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: project,
    });

    render(<TracingEmptyState organization={organization} project={project} />);

    await screen.findByText('Tracing in Sentry');

    await userEvent.click(screen.getByRole('radio', {name: 'Set up manually'}));

    expect(await screen.findByText('Install Sentry')).toBeInTheDocument();
  });

  it('shows only a docs link for unsupported platforms, with no tab switcher', async () => {
    const project = ProjectFixture({platform: 'elixir'});

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: project,
    });

    render(<TracingEmptyState organization={organization} project={project} />);

    const docsLink = await screen.findByRole('button', {name: 'Go to Documentation'});
    expect(docsLink).toHaveAttribute('href', 'https://docs.sentry.io/platforms/');
    expect(
      screen.queryByRole('radio', {name: 'Set up manually'})
    ).not.toBeInTheDocument();
  });

  it('shows the waiting indicator while no trace has arrived', async () => {
    const project = ProjectFixture({platform: 'javascript-react'});

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: project,
    });

    render(<TracingEmptyState organization={organization} project={project} />);

    expect(
      await screen.findByText("Waiting for this project's first trace")
    ).toBeInTheDocument();
  });
});
