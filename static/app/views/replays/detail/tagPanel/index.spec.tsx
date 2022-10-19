import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TagPanel from 'sentry/views/replays/detail/tagPanel';
import {RouteContext} from 'sentry/views/routeContext';

// Get replay data with the mocked replay reader params
const replayReaderParams = TestStubs.ReplayReaderParams({
  replayRecord: {
    tags: {
      'browser.name': ['Chrome'],
      'sdk.version': ['7.13.0', '7.13.2'],
    },
  },
});

const mockReplay = ReplayReader.factory(replayReaderParams);

const renderComponent = (replay: ReplayReader | null) => {
  const {router, organization} = initializeOrg();

  return render(
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: router.params,
          routes: router.routes,
        }}
      >
        <ReplayContextProvider replay={replay}>
          <TagPanel />
        </ReplayContextProvider>
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
};

describe('TagPanel', () => {
  it("should show a placeholder if there's no replay record", () => {
    renderComponent(null);

    expect(screen.getByTestId('replay-tags-loading-placeholder')).toBeInTheDocument();
  });

  it('should show the tags correctly inside ReplayTagsTableRow component with single item array', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('browser.name')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
  });

  it('should show the tags correctly inside ReplayTagsTableRow component with multiple items array', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('sdk.version')).toBeInTheDocument();
    expect(screen.getByText('7.13.0')).toBeInTheDocument();
    expect(screen.getByText('7.13.2')).toBeInTheDocument();
  });

  it('should snaptshot empty state', async () => {
    const {container} = renderComponent(null);

    await waitFor(() => {
      expect(container).toSnapshot();
    });
  });

  it('should snaptshot state with tags', async () => {
    const {container} = renderComponent(mockReplay);

    await waitFor(() => {
      expect(container).toSnapshot();
    });
  });

  it('should show not found message when no tags are found', () => {
    if (mockReplay) {
      mockReplay.getReplay = jest.fn().mockReturnValue({tags: {}});
    }

    renderComponent(mockReplay);

    expect(screen.getByText('No tags for this replay were found.')).toBeInTheDocument();
  });
});
