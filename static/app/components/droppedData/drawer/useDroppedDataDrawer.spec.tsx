import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
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
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SeerExplorerSidebarLayout} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerSidebarLayout';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/seerExplorerContextProvider';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

function mockDroppedData(count: number, statsPeriod: string) {
  const dropped = [OutcomeRowFixture({count})];
  const accepted = [OutcomeRowFixture({outcome: 'accepted', count: 90})];

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

function mockMultiOutcomeDroppedData() {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-dropped/`,
    body: {
      meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      droppedEvents: [
        OutcomeRowFixture({outcome: 'client_discard', reason: 'before_send', count: 4}),
        OutcomeRowFixture({
          outcome: 'client_discard',
          reason: 'network_error',
          count: 6,
        }),
        OutcomeRowFixture({
          outcome: 'filtered',
          reason: 'ignore_spans',
          count: 30,
          tags: ['intentional'],
        }),
      ],
      acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 60})],
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
    localStorage.clear();
  });

  it('adds the drawer to the URL when opened and removes it when closed', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();
    expect(router.location.query.droppedData).toBe('true');
    expect(trackAnalytics).toHaveBeenCalledWith(
      'explore.dropped_data.drawer_opened',
      expect.objectContaining({dataset: DiscoverDatasets.SPANS})
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
    await waitForDrawerToHide('Dropped and Filtered Spans');
    await waitFor(() => expect(router.location.query.droppedData).toBeUndefined());
  });

  it('shows the dropped total as a heading above a description', async () => {
    mockDroppedData(10, '14d');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(
      await screen.findByRole('heading', {name: '10 dropped and filtered spans'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your filtered events are broken down by category below/)
    ).toBeInTheDocument();
  });

  it('points to the docs instead of Seer when Seer Explorer is disabled', async () => {
    mockDroppedData(10, '14d');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(
      await screen.findByText(
        /Each reason links to docs with explanations and common fixes/
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Use Seer/)).not.toBeInTheDocument();
  });

  it('mentions Seer when Seer Explorer is enabled', async () => {
    const seerOrganization = OrganizationFixture({
      openMembership: true,
      hideAiFeatures: false,
      features: ['explore-data-fidelity-annotations', 'seer-explorer'],
    });
    mockDroppedData(10, '14d');

    render(<DroppedDataTrigger />, {
      organization: seerOrganization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(
      await screen.findByText(/Use Seer to understand what each category means/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Each reason links to docs/)).not.toBeInTheDocument();
  });

  it('uses the singular heading for one dropped event', async () => {
    mockDroppedData(1, '14d');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(
      await screen.findByRole('heading', {name: '1 dropped and filtered span'})
    ).toBeInTheDocument();
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
      await screen.findByText('There was an error loading dropped events.')
    ).toBeInTheDocument();
    expect(failedRequest).toHaveBeenCalledTimes(1);

    MockApiClient.clearMockResponses();
    mockDroppedData(10, '14d');
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();
  });

  it('opens when the URL already has the drawer param', async () => {
    mockDroppedData(10, '14d');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/explore/traces/', query: {droppedData: 'true'}},
      },
    });

    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();
  });

  it('restores the width the drawer was resized to', async () => {
    mockDroppedData(10, '14d');
    localStorage.setItem('drawer-width:dropped-data-drawer', '70');

    render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    const drawer = screen.getByRole('complementary', {
      name: 'Dropped and Filtered Spans',
    });
    expect(drawer.style.getPropertyValue('--drawer-width')).toBe('70%');
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
      screen.queryByRole('complementary', {name: 'Dropped and Filtered Spans'})
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

    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();
    expect(
      screen.getAllByRole('complementary', {name: 'Dropped and Filtered Spans'})
    ).toHaveLength(1);
  });

  it('closes when navigating back', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    router.navigate(-1);
    await waitForDrawerToHide('Dropped and Filtered Spans');
  });

  it('reopens when navigating forward', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    router.navigate(-1);
    await waitForDrawerToHide('Dropped and Filtered Spans');

    router.navigate(1);
    expect(
      await screen.findByRole('complementary', {name: 'Dropped and Filtered Spans'})
    ).toBeInTheDocument();
    expect(router.location.query.droppedData).toBe('true');
  });

  it('stays open and refreshes when zooming changes the time range', async () => {
    mockDroppedData(10, '14d');
    mockDroppedData(3, '1h');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    act(() => {
      router.navigate('/explore/traces/?droppedData=true&statsPeriod=1h');
      PageFiltersStore.updateDateTime({period: '1h', start: null, end: null, utc: false});
    });

    expect(await screen.findByText('3 dropped and filtered spans')).toBeInTheDocument();
  });

  it('fetches with the interval passed by the chart', async () => {
    const droppedDataRequest = mockDroppedData(10, '14d');

    render(<DroppedDataTrigger interval="1d" />, {
      organization,
      initialRouterConfig: {location: {pathname: '/discover/results/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();
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
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    rerender(<DroppedDataTrigger interval="4h" />);

    await waitFor(() =>
      expect(droppedDataRequest).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({query: expect.objectContaining({interval: '4h'})})
      )
    );
    expect(
      screen.getByRole('complementary', {name: 'Dropped and Filtered Spans'})
    ).toBeInTheDocument();
  });

  it('closes when navigating to another page', async () => {
    mockDroppedData(10, '14d');

    const {router} = render(<DroppedDataTrigger />, {
      organization,
      initialRouterConfig: {location: {pathname: '/explore/traces/'}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    router.navigate('/issues/');
    await waitForDrawerToHide('Dropped and Filtered Spans');
  });

  describe('legend filtering', () => {
    beforeEach(() => {
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('filters the total and outcome list to the selected outcomes', async () => {
      mockMultiOutcomeDroppedData();

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      await userEvent.click(await screen.findByRole('radio', {name: 'All'}));
      expect(
        await screen.findByText('40 dropped and filtered spans')
      ).toBeInTheDocument();
      expect(screen.getByText('Dropped by before send')).toBeInTheDocument();
      expect(screen.getByText('Dropped by ignored spans')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', {name: 'Inbound Filters'}));

      expect(trackAnalytics).toHaveBeenCalledWith(
        'explore.dropped_data.legend_outcome_toggled',
        expect.objectContaining({
          dataset: DiscoverDatasets.SPANS,
          outcome: 'filtered',
          selected: false,
        })
      );
      expect(screen.getByRole('checkbox', {name: 'Inbound Filters'})).not.toBeChecked();
      expect(screen.getByText('10 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.queryByText('Dropped by ignored spans')).not.toBeInTheDocument();
      expect(screen.getByText('Dropped by before send')).toBeInTheDocument();
      // Shares stay relative to all events, not just the selected outcomes.
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('lists unintentional and intentional drops under their headings', async () => {
      mockMultiOutcomeDroppedData();

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      await userEvent.click(await screen.findByRole('radio', {name: 'All'}));
      const unexpectedHeading = await screen.findByRole('heading', {
        name: 'Unexpected Drops',
      });
      const expectedHeading = screen.getByRole('heading', {name: 'Expected Drops'});
      const isAfter = (heading: HTMLElement, text: string) =>
        Boolean(
          heading.compareDocumentPosition(screen.getByText(text)) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      expect(isAfter(unexpectedHeading, 'Dropped by before send')).toBe(true);
      expect(isAfter(expectedHeading, 'Dropped by before send')).toBe(false);
      expect(isAfter(expectedHeading, 'Dropped by ignored spans')).toBe(true);

      await userEvent.click(screen.getByRole('checkbox', {name: 'Inbound Filters'}));

      expect(screen.getByRole('heading', {name: 'Unexpected Drops'})).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'Expected Drops'})
      ).not.toBeInTheDocument();
    });

    it('shows an empty state when every outcome is deselected', async () => {
      mockMultiOutcomeDroppedData();

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      await userEvent.click(await screen.findByRole('radio', {name: 'All'}));
      expect(
        await screen.findByText('40 dropped and filtered spans')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', {name: 'Client Discard'}));
      await userEvent.click(screen.getByRole('checkbox', {name: 'Inbound Filters'}));

      expect(screen.getByText('0 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.getByText('No outcomes selected.')).toBeInTheDocument();
      expect(screen.queryByText('Dropped by before send')).not.toBeInTheDocument();
      expect(screen.queryByText('Dropped by ignored spans')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', {name: 'Client Discard'}));

      expect(screen.getByText('10 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.queryByText('No outcomes selected.')).not.toBeInTheDocument();
      expect(screen.getByText('Dropped by before send')).toBeInTheDocument();
    });
  });

  describe('unexpected and all toggle', () => {
    beforeEach(() => {
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('shows only unintentional drops by default', async () => {
      mockMultiOutcomeDroppedData();

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      expect(
        await screen.findByText('10 dropped and filtered spans')
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', {name: 'Unexpected'})).toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'Client Discard'})).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', {name: 'Inbound Filters'})
      ).not.toBeInTheDocument();
      expect(screen.getByText('Dropped by before send')).toBeInTheDocument();
      expect(screen.queryByText('Dropped by ignored spans')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Unexpected Drops'})).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'Expected Drops'})
      ).not.toBeInTheDocument();
      // 10 unintentional drops out of 60 accepted + 10 dropped.
      expect(screen.getByText('14.29%')).toBeInTheDocument();
    });

    it('recomputes shares when switching to all values and back', async () => {
      mockMultiOutcomeDroppedData();

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      expect(await screen.findByText('14.29%')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: 'All'}));

      expect(screen.getByText('40 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', {name: 'Inbound Filters'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Expected Drops'})).toBeInTheDocument();
      expect(screen.getByText('Dropped by ignored spans')).toBeInTheDocument();
      // 10 unintentional drops out of 60 accepted + 40 dropped.
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.queryByText('14.29%')).not.toBeInTheDocument();
      expect(trackAnalytics).toHaveBeenCalledWith(
        'explore.dropped_data.scope_toggled',
        expect.objectContaining({dataset: DiscoverDatasets.SPANS, scope: 'all'})
      );

      await userEvent.click(screen.getByRole('radio', {name: 'Unexpected'}));

      expect(screen.getByText('10 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.getByText('14.29%')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'Expected Drops'})
      ).not.toBeInTheDocument();
    });

    it('explains when every drop is expected and offers to show them', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-dropped/`,
        body: {
          meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
          droppedEvents: [
            OutcomeRowFixture({
              outcome: 'filtered',
              reason: 'ignore_spans',
              count: 30,
              tags: ['intentional'],
            }),
          ],
          acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 60})],
        },
      });

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      expect(
        await screen.findByRole('heading', {name: 'No unexpected drops.'})
      ).toBeInTheDocument();
      expect(screen.queryByText('Dropped by ignored spans')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Show all drops'}));

      expect(screen.getByRole('radio', {name: 'All'})).toBeChecked();
      expect(screen.getByText('30 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.getByText('Dropped by ignored spans')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'No unexpected drops.'})
      ).not.toBeInTheDocument();
    });

    it('shows a plain empty state when nothing was dropped', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-dropped/`,
        body: {
          meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
          droppedEvents: [],
          acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 60})],
        },
      });

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      expect(
        await screen.findByRole('heading', {name: 'No dropped or filtered events.'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Show all drops'})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: 'All'}));

      expect(
        screen.getByRole('heading', {name: 'No dropped or filtered events.'})
      ).toBeInTheDocument();
    });

    it('keeps unexpected shares when a legend outcome is deselected', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-dropped/`,
        body: {
          meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
          droppedEvents: [
            OutcomeRowFixture({
              outcome: 'client_discard',
              reason: 'before_send',
              count: 10,
            }),
            OutcomeRowFixture({count: 20}),
            OutcomeRowFixture({
              outcome: 'filtered',
              reason: 'ignore_spans',
              count: 30,
              tags: ['intentional'],
            }),
          ],
          acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 40})],
        },
      });

      render(<DroppedDataTrigger />, {
        organization,
        initialRouterConfig: {location: {pathname: '/explore/traces/'}},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
      expect(
        await screen.findByText('30 dropped and filtered spans')
      ).toBeInTheDocument();
      // 10 client discards out of 40 accepted + 30 unintentional drops.
      expect(screen.getAllByText('14.29%')).toHaveLength(2);

      await userEvent.click(screen.getByRole('checkbox', {name: 'Rate Limited'}));

      expect(screen.getByText('10 dropped and filtered spans')).toBeInTheDocument();
      expect(screen.getAllByText('14.29%')).toHaveLength(2);
    });
  });

  it('hands off to Seer Explorer from a reason’s Ask Seer button', async () => {
    const seerOrganization = OrganizationFixture({
      openMembership: true,
      hideAiFeatures: false,
      features: ['explore-data-fidelity-annotations', 'seer-explorer'],
    });
    mockDroppedData(10, '14d');
    const chatUrl = `/organizations/${seerOrganization.slug}/seer/explorer-chat/`;
    MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
    MockApiClient.addMockResponse({
      url: chatUrl,
      method: 'POST',
      body: {run_id: 1, message: {role: 'user', content: ''}},
    });
    MockApiClient.addMockResponse({
      url: `${chatUrl}1/`,
      method: 'GET',
      body: {session: {run_id: 1, blocks: [], status: 'completed'}},
    });
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
                <SeerExplorerSidebarLayout>
                  <DroppedDataTrigger />
                </SeerExplorerSidebarLayout>
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
    expect(await screen.findByText('10 dropped and filtered spans')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Ask Seer'}));

    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    await waitFor(() => expect(router.location.query.droppedData).toBeUndefined());
    expect(screen.getByTestId('seer-explorer-input')).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'explore.dropped_data.ask_seer_clicked',
      expect.objectContaining({dataset: DiscoverDatasets.SPANS, outcome: 'rate_limited'})
    );
  });
});
