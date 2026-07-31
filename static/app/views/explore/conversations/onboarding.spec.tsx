import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';

import {ConversationOnboarding} from './onboarding';

jest.mock('sentry/utils/analytics');

describe('ConversationOnboarding deployment target', () => {
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
    // The last onboarding step waits for the first conversation span.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    return {organization, project};
  }

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('defaults a Node project to the Node target and installs @sentry/node', async () => {
    const {organization} = setupProject('node');

    render(<ConversationOnboarding onDismiss={jest.fn()} />, {organization});

    expect(await screen.findByRole('button', {name: 'Node'})).toBeInTheDocument();
    expect(
      (await screen.findAllByText(textWithMarkupMatcher(/npm install @sentry\/node/)))
        .length
    ).toBeGreaterThan(0);
  });

  it('pins Cloudflare projects to the Cloudflare runtime with no Node toggle', async () => {
    const {organization} = setupProject('node-cloudflare-workers');

    render(<ConversationOnboarding onDismiss={jest.fn()} />, {organization});

    expect(
      (
        await screen.findAllByText(
          textWithMarkupMatcher(/npm install @sentry\/cloudflare/)
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', {name: 'Node'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cloudflare'})).not.toBeInTheDocument();
  });

  it('switches instructions when the deployment target changes', async () => {
    const {organization} = setupProject('node');

    render(<ConversationOnboarding onDismiss={jest.fn()} />, {organization});

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

  it('tracks AI prompt copy for conversations onboarding', async () => {
    const {organization} = setupProject('node');

    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });

    render(<ConversationOnboarding onDismiss={jest.fn()} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Copy instructions'}));

    expect(trackAnalytics).toHaveBeenCalledWith('onboarding.ai_prompt_copied', {
      organization,
      platform: 'node',
      product: 'conversations',
      source: 'prompt',
    });
  });
});
