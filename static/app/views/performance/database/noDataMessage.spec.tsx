import {PageFilters} from 'sentry-fixture/pageFilters';
import {Project} from 'sentry-fixture/project';
import {ProjectSdkUpdates} from 'sentry-fixture/projectSdkUpdates';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import importedUsePageFilters from 'sentry/utils/usePageFilters';

jest.mock('sentry/utils/usePageFilters');

const usePageFilters = jest.mocked(importedUsePageFilters);

import {NoDataMessage} from 'sentry/views/performance/database/noDataMessage';

describe('NoDataMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    usePageFilters.mockClear();

    ProjectsStore.loadInitialData([Project({name: 'Awesome API', slug: 'awesome-api'})]);

    usePageFilters.mockImplementation(() => ({
      selection: PageFilters({projects: [2]}),
      isReady: true,
      shouldPersist: true,
      pinnedFilters: new Set(),
      desyncedFilters: new Set(),
    }));
  });

  it('does not show anything if there is recent data', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    const eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'project.id': 2, 'count()': 1}],
      },
    });

    render(<NoDataMessage />);

    await waitFor(() => expect(eventsMock).toHaveBeenCalled());
    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.queryByText(textWithMarkupMatcher('No queries found.'))
    ).not.toBeInTheDocument();
  });

  it('shows a no data message if there is no recent data', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    const eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
    });

    render(<NoDataMessage />);

    await waitFor(() => expect(eventsMock).toHaveBeenCalled());
    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.queryByText(textWithMarkupMatcher('No queries found.'))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        textWithMarkupMatcher('You may also be missing data due to outdated SDKs')
      )
    ).not.toBeInTheDocument();
  });

  it('shows a list of outdated SDKs if there is no data available and SDKs are outdated', async function () {
    const sdkMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [ProjectSdkUpdates({projectId: '2'})],
    });

    const eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
      },
    });

    render(<NoDataMessage />);

    await waitFor(() => expect(eventsMock).toHaveBeenCalled());
    await waitFor(() => expect(sdkMock).toHaveBeenCalled());
    await tick(); // There is no visual indicator, this awaits the promise resolve

    expect(
      screen.queryByText(textWithMarkupMatcher('No queries found.'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher('You may also be missing data due to outdated SDKs')
      )
    ).toBeInTheDocument();

    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/awesome-api/'
    );
  });
});
