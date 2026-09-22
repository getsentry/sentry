import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import type {ExploreSurface} from 'sentry/views/explore/components/exploreSavedQueryBreadcrumbs';
import {ExploreSavedQueryBreadcrumbs} from 'sentry/views/explore/components/exploreSavedQueryBreadcrumbs';
import {TopBar} from 'sentry/views/navigation/topBar';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture();

const SAVED_QUERY_URL = `/organizations/${organization.slug}/explore/saved/7/`;

function savedQueryBody(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'p95 checkout latency',
    dataset: 'spans',
    projects: [1],
    starred: false,
    query: [{visualize: [], groupby: []}],
    ...overrides,
  };
}

function renderBreadcrumbs(surface: ExploreSurface) {
  return render(
    <TopBar.Slot.Provider>
      <TopBar />
      <ExploreSavedQueryBreadcrumbs
        surface={surface}
        savedQueryId="7"
        title="p95 checkout latency"
      />
    </TopBar.Slot.Provider>,
    {organization}
  );
}

describe('ExploreSavedQueryBreadcrumbs', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    MockApiClient.addMockResponse({url: SAVED_QUERY_URL, body: savedQueryBody()});
  });

  describe('trail and title', () => {
    const cases: Array<{parent: string; surface: ExploreSurface; to: string}> = [
      {
        surface: 'traces',
        parent: 'Traces',
        to: '/organizations/org-slug/explore/traces/',
      },
      {surface: 'logs', parent: 'Logs', to: '/organizations/org-slug/explore/logs/'},
      {
        surface: 'metrics',
        parent: 'Application Metrics',
        to: '/organizations/org-slug/explore/metrics/',
      },
      {
        surface: 'replays',
        parent: 'Replays',
        to: '/organizations/org-slug/explore/replays/',
      },
      {
        surface: 'agents',
        parent: 'Agents',
        to: '/organizations/org-slug/explore/agents/',
      },
    ];

    it.each(cases)(
      'links $parent as the parent crumb on the $surface surface',
      async ({surface, parent, to}) => {
        renderBreadcrumbs(surface);

        const trail = await screen.findByRole('list');
        expect(within(trail).getByRole('link', {name: parent})).toHaveAttribute(
          'href',
          expect.stringContaining(to)
        );

        // The query name is the page heading, and must not be repeated in the trail.
        expect(
          await screen.findByRole('heading', {name: /p95 checkout latency/, level: 1})
        ).toBeInTheDocument();
        expect(within(trail).queryByText('p95 checkout latency')).not.toBeInTheDocument();
        // A parent crumb is a link, never a second heading.
        expect(screen.queryByRole('heading', {name: parent})).not.toBeInTheDocument();
      }
    );

    it('keeps Compare Queries in the trail so compare mode is not lost', async () => {
      renderBreadcrumbs('compare');

      const trail = await screen.findByRole('list');
      expect(
        within(trail)
          .getAllByRole('link')
          .map(link => link.textContent)
      ).toEqual(['Traces', 'Compare Queries']);
    });

    it('shows the url title until the saved query resolves', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: SAVED_QUERY_URL,
        body: savedQueryBody(),
        asyncDelay: new Promise<void>(() => {}),
      });

      renderBreadcrumbs('traces');

      expect(
        await screen.findByRole('heading', {name: 'p95 checkout latency', level: 1})
      ).toBeInTheDocument();
      expect(screen.queryByText('Saved Query')).not.toBeInTheDocument();
    });
  });

  describe('title actions', () => {
    it('renders the actions menu before the star toggle', async () => {
      renderBreadcrumbs('traces');

      const menu = await screen.findByRole('button', {name: 'More saved query options'});
      const star = screen.getByRole('button', {name: 'Star'});

      expect(
        menu.compareDocumentPosition(star) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('offers rename, duplicate and delete for a user query', async () => {
      renderBreadcrumbs('traces');

      await userEvent.click(
        await screen.findByRole('button', {name: 'More saved query options'})
      );

      expect(
        screen.getAllByRole('menuitemradio').map(item => item.textContent?.trim())
      ).toEqual(['Rename', 'Duplicate', 'Delete']);
    });

    it('offers only duplicate for a prebuilt query', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: SAVED_QUERY_URL,
        body: savedQueryBody({isPrebuilt: true}),
      });

      renderBreadcrumbs('traces');

      await userEvent.click(
        await screen.findByRole('button', {name: 'More saved query options'})
      );

      expect(
        screen.getAllByRole('menuitemradio').map(item => item.textContent?.trim())
      ).toEqual(['Duplicate']);
    });

    it('reverts the star when the request fails', async () => {
      MockApiClient.addMockResponse({
        url: `${SAVED_QUERY_URL}starred/`,
        method: 'POST',
        statusCode: 500,
      });

      renderBreadcrumbs('traces');

      await userEvent.click(await screen.findByRole('button', {name: 'Star'}));

      // The optimistic flip is rolled back rather than stranding the UI as
      // starred. `starQuery` is a promise, so this only holds if the rejection
      // is actually handled.
      expect(await screen.findByRole('button', {name: 'Star'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Unstar'})).not.toBeInTheDocument();
    });

    it('stars the query and flips the label', async () => {
      const starMock = MockApiClient.addMockResponse({
        url: `${SAVED_QUERY_URL}starred/`,
        method: 'POST',
      });

      renderBreadcrumbs('traces');

      await userEvent.click(await screen.findByRole('button', {name: 'Star'}));

      expect(starMock).toHaveBeenCalledWith(
        `${SAVED_QUERY_URL}starred/`,
        expect.objectContaining({data: {starred: true}})
      );
      expect(await screen.findByRole('button', {name: 'Unstar'})).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    const destinations: Array<{surface: ExploreSurface; to: string}> = [
      {surface: 'traces', to: '/organizations/org-slug/explore/traces/'},
      {surface: 'compare', to: '/organizations/org-slug/explore/traces/compare/'},
      {surface: 'logs', to: '/organizations/org-slug/explore/logs/'},
      {surface: 'metrics', to: '/organizations/org-slug/explore/metrics/'},
      {surface: 'replays', to: '/organizations/org-slug/explore/replays/'},
      {surface: 'agents', to: '/organizations/org-slug/explore/agents/'},
    ];

    it.each(destinations)(
      'returns the $surface surface to its own landing page',
      async ({surface, to}) => {
        const deleteMock = MockApiClient.addMockResponse({
          url: SAVED_QUERY_URL,
          method: 'DELETE',
        });

        const {router} = renderBreadcrumbs(surface);
        renderGlobalModal();

        await userEvent.click(
          await screen.findByRole('button', {name: 'More saved query options'})
        );
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));
        await userEvent.click(screen.getByRole('button', {name: 'Delete Query'}));

        await waitFor(() => expect(deleteMock).toHaveBeenCalled());
        await waitFor(() => expect(router.location.pathname).toBe(to));
      }
    );
  });

  describe('analytics', () => {
    async function deleteQuery(surface: ExploreSurface) {
      MockApiClient.addMockResponse({url: SAVED_QUERY_URL, method: 'DELETE'});
      renderBreadcrumbs(surface);
      renderGlobalModal();

      await userEvent.click(
        await screen.findByRole('button', {name: 'More saved query options'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));
      await userEvent.click(screen.getByRole('button', {name: 'Delete Query'}));
    }

    it('reports a traces delete under trace_explorer', async () => {
      await deleteQuery('traces');

      await waitFor(() =>
        expect(trackAnalytics).toHaveBeenCalledWith(
          'trace_explorer.delete_query',
          expect.anything()
        )
      );
    });

    it('reports a logs delete under logs', async () => {
      await deleteQuery('logs');

      await waitFor(() =>
        expect(trackAnalytics).toHaveBeenCalledWith(
          'logs.delete_query',
          expect.anything()
        )
      );
    });

    // `ai_conversations` saved queries resolve to TraceItemDataset.SPANS, so a
    // dataset-keyed check would file Agents activity under Trace Explorer.
    it.each<ExploreSurface>(['metrics', 'replays', 'agents'])(
      'reports no delete event for %s, which has none registered',
      async surface => {
        await deleteQuery(surface);

        await waitFor(() =>
          expect(
            jest
              .mocked(trackAnalytics)
              .mock.calls.filter(([event]) => String(event).endsWith('.delete_query'))
          ).toHaveLength(0)
        );
      }
    );
  });
});
