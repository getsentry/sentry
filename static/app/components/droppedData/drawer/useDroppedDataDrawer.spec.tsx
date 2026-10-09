import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {useDroppedDataDrawer} from 'sentry/components/droppedData/drawer/useDroppedDataDrawer';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/seerExplorerContextProvider';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

function mockDroppedData(count: number, statsPeriod: string) {
  const dropped = [DroppedEventFixture({count})];
  const accepted = [DroppedEventFixture({outcome: 'accepted', count: 90})];

  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-dropped/`,
    match: [MockApiClient.matchQuery({statsPeriod})],
    body: {
      meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      droppedEvents: dropped,
      acceptedEvents: accepted,
    },
  });
}

function DroppedDataTrigger({enabled, interval}: {enabled?: boolean; interval?: string}) {
  const openDroppedDataDrawer = useDroppedDataDrawer(
    {dataset: DiscoverDatasets.SPANS, interval},
    {enabled}
  );
  return <Button onClick={openDroppedDataDrawer}>Open dropped data</Button>;
}

describe('useDroppedDataDrawer', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        datetime: {period: '14d', start: null, end: null, utc: false},
      })
    );
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('adds the drawer to the URL when opened and removes it when closed', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();
    expect(router.location.query.droppedData).toBe('true');

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitForDrawerToHide('Dropped Data');
    await waitFor(() => expect(router.location.query.droppedData).toBeUndefined());
  });

  it('shows an error with retry when the request fails', async () => {
    const failedRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(
      await screen.findByText('There was an error loading dropped data.')
    ).toBeInTheDocument();
    expect(failedRequest).toHaveBeenCalledTimes(1);

    MockApiClient.clearMockResponses();
    mockDroppedData(10, '14d');
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();
  });

  it('opens when the URL already has the drawer param', async () => {
    mockDroppedData(10, '14d');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/explore/traces/', query: {droppedData: 'true'}},
      },
    });

    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();
  });

  it('does not open from the URL param when disabled', async () => {
    const droppedDataRequest = mockDroppedData(10, '14d');

    render(<DroppedDataTrigger enabled={false} />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/discover/results/', query: {droppedData: 'true'}},
      },
    });

    expect(
      await screen.findByRole('button', {name: 'Open dropped data'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: 'Dropped Data'})
    ).not.toBeInTheDocument();
    expect(droppedDataRequest).not.toHaveBeenCalled();
  });

  it('opens a single drawer when several charts use the hook', async () => {
    mockDroppedData(10, '14d');

    render(
      <div>
        <DroppedDataTrigger />
        <DroppedDataTrigger />
      </div>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: '/explore/traces/', query: {droppedData: 'true'}},
        },
      }
    );

    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', {name: 'Dropped Data'})).toHaveLength(1);
  });

  it('closes when navigating back', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    router.navigate(-1);
    await waitForDrawerToHide('Dropped Data');
  });

  it('stays open and refreshes when zooming changes the time range', async () => {
    mockDroppedData(10, '14d');
    mockDroppedData(3, '1h');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    act(() => {
      router.navigate('/explore/traces/?droppedData=true&statsPeriod=1h');
      PageFiltersStore.updateDateTime({period: '1h', start: null, end: null, utc: false});
    });

    expect(await screen.findByText('3 Dropped Events')).toBeInTheDocument();
  });

  it('fetches with the interval passed by the chart', async () => {
    const droppedDataRequest = mockDroppedData(10, '14d');

    render(<DroppedDataTrigger interval="1d" />, {
      organization,
      initialRouterConfig: {location: {pathname: '/discover/results/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();
    expect(droppedDataRequest).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({query: expect.objectContaining({interval: '1d'})})
    );
  });

  it('refetches in place when the chart interval changes', async () => {
    const droppedDataRequest = mockDroppedData(10, '14d');

    const {rerender} = render(<DroppedDataTrigger interval="1d" />, {
      organization,
      initialRouterConfig: {location: {pathname: '/discover/results/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    rerender(<DroppedDataTrigger interval="4h" />);

    await waitFor(() =>
      expect(droppedDataRequest).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({query: expect.objectContaining({interval: '4h'})})
      )
    );
    expect(screen.getByRole('complementary', {name: 'Dropped Data'})).toBeInTheDocument();
  });

  it('closes when navigating to another page', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    router.navigate('/issues/');
    await waitForDrawerToHide('Dropped Data');
  });

  it('hands off to Seer Explorer from a reason’s investigate action', async () => {
    const seerOrganization = OrganizationFixture({
      openMembership: true,
      hideAiFeatures: false,
      features: ['explore-data-fidelity-annotations', 'seer-explorer'],
    });
    mockDroppedData(10, '14d');
    const chatUrl = `/organizations/${seerOrganization.slug}/seer/explorer-chat/`;
    MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
    MockApiClient.addMockResponse({
      url: `/organizations/${seerOrganization.slug}/seer/runs/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${seerOrganization.slug}/integrations/`,
      body: [],
    });

    const {router} = render(
      <SeerExplorerSessionsProvider>
        <SeerExplorerChatStateProvider>
          <PictureInPictureProvider>
            <GlobalDrawer>
              <SeerExplorerContextProvider>
                <DroppedDataTrigger />
              </SeerExplorerContextProvider>
            </GlobalDrawer>
          </PictureInPictureProvider>
        </SeerExplorerChatStateProvider>
      </SeerExplorerSessionsProvider>,
      {
        organization: seerOrganization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Toggle fix options'}));
    await userEvent.click(screen.getByRole('button', {name: 'Fix this'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Investigate'}));

    expect(
      await screen.findByRole('complementary', {name: 'Seer Explorer Drawer'})
    ).toBeInTheDocument();
    await waitFor(() => expect(router.location.query.droppedData).toBeUndefined());
    expect(
      screen.getByRole('complementary', {name: 'Seer Explorer Drawer'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: 'Dropped Data'})
    ).not.toBeInTheDocument();
  });
});
