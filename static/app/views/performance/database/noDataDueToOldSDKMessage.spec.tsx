import {PageFilters} from 'sentry-fixture/pageFilters';
import {Project} from 'sentry-fixture/project';
import {ProjectSdkUpdates} from 'sentry-fixture/projectSdkUpdates';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import importedUsePageFilters from 'sentry/utils/usePageFilters';

jest.mock('sentry/utils/usePageFilters');

const usePageFilters = jest.mocked(importedUsePageFilters);

import {NoDataDueToOldSDKMessage} from 'sentry/views/performance/database/noDataDueToOldSDKMessage';

describe('NoDataDueToOldSDKMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    usePageFilters.mockClear();
    ProjectsStore.loadInitialData([Project({name: 'Awesome API', slug: 'awesome-api'})]);
  });

  it('shows a list of outdated SDKs if there is no data available and SDKs are outdated', async function () {
    usePageFilters.mockImplementation(() => ({
      selection: PageFilters({projects: [2]}),
      isReady: true,
      shouldPersist: true,
      pinnedFilters: new Set(),
      desyncedFilters: new Set(),
    }));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [ProjectSdkUpdates({projectId: '2'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: {count: 1},
      },
    });

    render(<NoDataDueToOldSDKMessage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          textWithMarkupMatcher('You may be missing data due to outdated SDKs.')
        )
      ).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/awesome-api/'
    );
  });
});
