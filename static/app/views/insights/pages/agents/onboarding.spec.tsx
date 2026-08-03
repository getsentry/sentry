import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {PlatformKey} from 'sentry/types/platform';

import {NoDocsOnboarding, Onboarding, UnsupportedPlatformOnboarding} from './onboarding';

describe('UnsupportedPlatformOnboarding', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('renders CopyMarkdownButton', () => {
    const organization = OrganizationFixture();

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    expect(screen.getByRole('button', {name: 'Copy instructions'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can manually instrument your agents using the Sentry SDK tracing API, or click Copy instructions to have an AI coding agent do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    const organization = OrganizationFixture();

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });
});

describe('Onboarding deployment target', () => {
  function setupProject(platform: PlatformKey) {
    const organization = OrganizationFixture();
    const project = ProjectFixture({platform, firstTransactionEvent: false});

    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [Number(project.id)]}),
      false
    );

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      body: ProjectKeysFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });
    // The last onboarding step waits for the first AI span via a spans query.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    return {organization, project};
  }

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('defaults a Node project to the Node target and installs @sentry/node', async () => {
    const {organization} = setupProject('node');

    render(<Onboarding />, {organization});

    // The deployment-target selector renders alongside the integration selector
    expect(await screen.findByRole('button', {name: 'Node'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Vercel AI SDK'})).toBeInTheDocument();
    expect(
      (await screen.findAllByText(textWithMarkupMatcher(/npm install @sentry\/node/)))
        .length
    ).toBeGreaterThan(0);
  });

  it('pins Cloudflare Workers projects to the Cloudflare runtime with no Node toggle', async () => {
    const {organization} = setupProject('node-cloudflare-workers');

    render(<Onboarding />, {organization});

    // Cloudflare install instructions render...
    expect(
      (
        await screen.findAllByText(
          textWithMarkupMatcher(/npm install @sentry\/cloudflare/)
        )
      ).length
    ).toBeGreaterThan(0);
    // ...but there is no Node/Cloudflare deployment selector (it's always Cloudflare)
    expect(screen.queryByRole('button', {name: 'Node'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cloudflare'})).not.toBeInTheDocument();
  });

  it('does not show the deployment selector for Cloudflare Pages', async () => {
    const {organization} = setupProject('node-cloudflare-pages');

    render(<Onboarding />, {organization});

    // Pages keeps its existing onboarding and is left out of the runtime selector
    expect(
      await screen.findByRole('button', {name: 'Vercel AI SDK'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Node'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cloudflare'})).not.toBeInTheDocument();
  });

  it('offers Workers AI as an integration only on the Cloudflare target', async () => {
    const {organization} = setupProject('node');

    render(<Onboarding />, {organization});

    // Node target: Workers AI is not in the integration list
    await userEvent.click(await screen.findByRole('button', {name: 'Vercel AI SDK'}));
    expect(screen.queryByRole('option', {name: 'Workers AI'})).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    // Switch to the Cloudflare target
    await userEvent.click(screen.getByRole('button', {name: 'Node'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Cloudflare'}));

    // Cloudflare target: Workers AI is now offered
    await userEvent.click(await screen.findByRole('button', {name: 'Vercel AI SDK'}));
    expect(await screen.findByRole('option', {name: 'Workers AI'})).toBeInTheDocument();
  });

  it('switches instructions when the deployment target changes', async () => {
    const {organization} = setupProject('node');

    render(<Onboarding />, {organization});

    // Starts on the Node target
    expect(
      (await screen.findAllByText(textWithMarkupMatcher(/npm install @sentry\/node/)))
        .length
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', {name: 'Node'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Cloudflare'}));

    expect(
      (
        await screen.findAllByText(
          textWithMarkupMatcher(/npm install @sentry\/cloudflare/)
        )
      ).length
    ).toBeGreaterThan(0);
  });
});

describe('NoDocsOnboarding', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('renders CopyMarkdownButton', () => {
    const organization = OrganizationFixture();

    render(<NoDocsOnboarding project={project} />, {organization});

    expect(screen.getByRole('button', {name: 'Copy instructions'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can set up the Sentry SDK by following our documentation, or click Copy instructions to have an AI coding agent do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    const organization = OrganizationFixture();

    render(<NoDocsOnboarding project={project} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });
});
