import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {FeatureFlagTagsFixture} from 'sentry-fixture/tags';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import ProjectsStore from 'sentry/stores/projectsStore';
import FlagDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';

describe('GroupFeatureFlagsDrawerContent', function () {
  function getEmptyState() {
    return screen.queryByTestId('empty-state') ?? screen.getByTestId('empty-message');
  }

  beforeEach(function () {
    jest.resetAllMocks();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/suspect/flags/`,
      body: [],
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript', hasFlags: false}),
    ]);
  });

  it('calls flags backend and renders distribution cards', async function () {
    const mockTagsEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: FeatureFlagTagsFixture(),
    });

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(mockTagsEndpoint).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1/tags/',
      expect.objectContaining({
        query: expect.objectContaining({useFlagsBackend: '1'}),
      })
    );

    expect(screen.getByText('feature.organizations:my-feature')).toBeInTheDocument();
    expect(screen.getByText('my-rolled-out-feature')).toBeInTheDocument();
  });

  it('renders error state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      statusCode: 400,
      body: {
        detail: 'Bad request',
      },
    });

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-error')).toBeInTheDocument();
    });
  });

  it('renders empty state when no flags match the search', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/tags/`,
      body: FeatureFlagTagsFixture(),
    });

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search="zxf"
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const emptyState = getEmptyState();
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent('No feature flags were found for this search');
  });

  it('renders empty state when no flags returned and hasFlags', async function () {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript', hasFlags: true}),
    ]);

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const emptyState = getEmptyState();
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent('No feature flags were found for this issue');
  });

  it('renders CTA when no flags returned and hasFlags is false', async function () {
    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Set Up Feature Flags')).toBeInTheDocument();
  });

  it('does not render CTA when no flags returned and platform unsupported', async function () {
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'dotnet-awslambda', hasFlags: false}),
    ]);

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(getEmptyState()).toBeInTheDocument();
  });

  it('does not render CTA when project not found', async function () {
    ProjectsStore.reset();

    render(
      <FlagDrawerContent
        environments={[]}
        group={GroupFixture()}
        search=""
        orderBy={OrderBy.NEWEST}
        sortBy={SortBy.EVAL_ORDER}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(getEmptyState()).toBeInTheDocument();
  });
});
