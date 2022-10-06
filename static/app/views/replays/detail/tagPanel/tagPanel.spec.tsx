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
      'browser.version': ['105.0.0'],
      'device.brand': ['Apple'],
      'device.family': ['Mac family'],
      'device.model': ['Mac model'],
      organization: ['1176005'],
      'organization.slug': ['sentry-emerging-tech'],
      'os.name': ['Mac OS X'],
      'os.version': ['10.15.7'],
      'sdk.name': ['sentry.javascript.react'],
      'sdk.version': ['7.13.0', '7.13.2'],
      'user.ip_address': ['127.0.0.1'],
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

  it('should show the tags correctly', () => {
    renderComponent(mockReplay);

    expect(screen.getByText('browser.name')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();

    expect(screen.getByText('browser.version')).toBeInTheDocument();
    expect(screen.getByText('105.0.0')).toBeInTheDocument();

    expect(screen.getByText('device.family')).toBeInTheDocument();
    expect(screen.getByText('Mac family')).toBeInTheDocument();

    expect(screen.getByText('device.model')).toBeInTheDocument();
    expect(screen.getByText('Mac model')).toBeInTheDocument();

    expect(screen.getByText('os.name')).toBeInTheDocument();
    expect(screen.getByText('Mac OS X')).toBeInTheDocument();

    expect(screen.getByText('os.version')).toBeInTheDocument();
    expect(screen.getByText('10.15.7')).toBeInTheDocument();

    expect(screen.getByText('sdk.name')).toBeInTheDocument();
    expect(screen.getByText('sentry.javascript.react')).toBeInTheDocument();

    expect(screen.getByText('sdk.version')).toBeInTheDocument();
    expect(screen.getByText('7.13.0')).toBeInTheDocument();
    expect(screen.getByText('7.13.2')).toBeInTheDocument();

    expect(screen.getByText('user.ip_address')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();

    expect(screen.getByText('organization')).toBeInTheDocument();
    expect(screen.getByText('1176005')).toBeInTheDocument();

    expect(screen.getByText('organization.slug')).toBeInTheDocument();
    expect(screen.getByText('sentry-emerging-tech')).toBeInTheDocument();
  });

  it('should snaptshot empty state', async () => {
    const {container} = renderComponent(null);

    await waitFor(() => {
      expect(container).toSnapshot();
    });
  });
});
