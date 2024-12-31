import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectSdkUpdatesFixture} from 'sentry-fixture/projectSdkUpdates';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import importedUsePageFilters from 'sentry/utils/usePageFilters';

jest.mock('sentry/utils/usePageFilters');

const usePageFilters = jest.mocked(importedUsePageFilters);

import {NoDataMessage} from 'sentry/views/insights/database/components/noDataMessage';

describe('NoDataMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    usePageFilters.mockClear();

    ProjectsStore.loadInitialData([
      ProjectFixture({
        name: 'Awesome API',
        slug: 'awesome-api',
        features: ['span-metrics-extraction'],
      }),
    ]);

    usePageFilters.mockImplementation(() => ({
      selection: PageFiltersFixture({projects: [2]}),
      isReady: true,
      shouldPersist: true,
      pinnedFilters: new Set(),
      desyncedFilters: new Set(),
    }));
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('does not show anything if there is recent data', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    render(<NoDataMessage isDataAvailable />);

    expect(
      screen.queryByText(textWithMarkupMatcher('No queries found.'))
    ).not.toBeInTheDocument();
  });

  it('shows a no data message if there is no recent data', async function () {
    const sdkMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    render(<NoDataMessage isDataAvailable={false} />);
    await waitFor(() => expect(sdkMock).toHaveBeenCalled());
    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.getByText(textWithMarkupMatcher('No queries found.'))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        textWithMarkupMatcher('You may be missing data due to outdated SDKs')
      )
    ).not.toBeInTheDocument();
  });

  it('shows a list of outdated SDKs if there is no data available and SDKs are outdated', async function () {
    const sdkMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [ProjectSdkUpdatesFixture({projectId: '2'})],
    });

    render(<NoDataMessage isDataAvailable={false} />);

    await waitFor(() => expect(sdkMock).toHaveBeenCalled());
    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.getByText(textWithMarkupMatcher('No queries found.'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher('You may be missing data due to outdated SDKs')
      )
    ).toBeInTheDocument();

    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/awesome-api/'
    );
  });

  it('shows a list of denylisted projects if any are are set even if data is available', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({
        name: 'Awful API',
        slug: 'awful-api',
        features: [],
      }),
    ]);

    render(<NoDataMessage isDataAvailable />);

    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Some of your projects have been omitted from query performance analysis'
        )
      )
    ).toBeInTheDocument();

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/awful-api/'
    );
  });
});
