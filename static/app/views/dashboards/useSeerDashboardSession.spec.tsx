import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {useSeerDashboardSession} from 'sentry/views/dashboards/useSeerDashboardSession';

const SEER_RUN_ID = 456;

function makeSeerApiUrl(orgSlug: string, runId: number) {
  return `/organizations/${orgSlug}/seer/explorer-chat/${runId}/`;
}

const COMPLETED_SESSION = {
  session: {
    run_id: SEER_RUN_ID,
    status: 'completed',
    updated_at: '2026-01-01T00:00:00Z',
    blocks: [
      {
        id: 'block-1',
        message: {content: 'Here is your dashboard', role: 'assistant'},
        timestamp: '2026-01-01T00:00:00Z',
        artifacts: [
          {
            key: 'dashboard',
            reason: 'generated',
            data: {
              title: 'Generated Dashboard',
              widgets: [
                {
                  title: 'Error Count',
                  display_type: 'line',
                  widget_type: 'error-events',
                  queries: [
                    {
                      name: '',
                      conditions: '',
                      fields: ['count()'],
                      columns: [],
                      aggregates: ['count()'],
                      orderby: '',
                    },
                  ],
                  layout: {x: 0, y: 0, w: 3, h: 2, min_h: 2},
                  interval: '1h',
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

describe('useSeerDashboardSession', () => {
  const organization = OrganizationFixture();
  const apiUrl = makeSeerApiUrl(organization.slug, SEER_RUN_ID);

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns session data when polling a completed session', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: COMPLETED_SESSION,
    });

    const onDashboardUpdate = jest.fn();

    const {result} = renderHookWithProviders(
      () =>
        useSeerDashboardSession({
          seerRunId: SEER_RUN_ID,
          onDashboardUpdate,
        }),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.session).toBeDefined();
      expect(result.current.session?.status).toBe('completed');
    });
  });

  it('sends follow-up messages to the Seer session', async () => {
    MockApiClient.addMockResponse({
      url: apiUrl,
      body: COMPLETED_SESSION,
    });

    const postMock = MockApiClient.addMockResponse({
      url: apiUrl,
      method: 'POST',
      body: {},
    });

    const onDashboardUpdate = jest.fn();

    const {result} = renderHookWithProviders(
      () =>
        useSeerDashboardSession({
          seerRunId: SEER_RUN_ID,
          onDashboardUpdate,
        }),
      {organization}
    );

    await act(async () => {
      await result.current.sendFollowUpMessage('Add an error rate widget');
    });

    expect(postMock).toHaveBeenCalledWith(
      apiUrl,
      expect.objectContaining({
        method: 'POST',
        data: {query: 'Add an error rate widget'},
      })
    );
  });

  it('starts a new session via the generate endpoint when dashboard is provided without seerRunId', async () => {
    const dashboard = {
      title: 'My Dashboard',
      widgets: [
        {
          title: 'Count',
          displayType: DisplayType.LINE,
          interval: '1h',
          queries: [
            {
              name: '',
              conditions: '',
              fields: ['count()'],
              columns: [],
              aggregates: ['count()'],
              orderby: '',
            },
          ],
        },
      ],
    };

    const generateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/generate/`,
      method: 'POST',
      body: {run_id: '789'},
    });

    MockApiClient.addMockResponse({
      url: makeSeerApiUrl(organization.slug, 789),
      body: {
        session: {
          run_id: 789,
          status: 'processing',
          updated_at: '2026-01-01T00:00:00Z',
          blocks: [],
        },
      },
    });

    const onDashboardUpdate = jest.fn();

    const {result} = renderHookWithProviders(
      () =>
        useSeerDashboardSession({
          dashboard,
          onDashboardUpdate,
        }),
      {organization}
    );

    await act(async () => {
      await result.current.sendFollowUpMessage('Add me another widget');
    });

    expect(generateMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/dashboards/generate/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          prompt: 'Add me another widget',
          current_dashboard: {
            title: 'My Dashboard',
            widgets: dashboard.widgets,
          },
        },
      })
    );

    await waitFor(() => {
      expect(result.current.session).toBeDefined();
    });
  });

  it('does nothing when sendFollowUpMessage is called without seerRunId or dashboard', async () => {
    const onDashboardUpdate = jest.fn();

    const {result} = renderHookWithProviders(
      () =>
        useSeerDashboardSession({
          onDashboardUpdate,
        }),
      {organization}
    );

    await act(async () => {
      await result.current.sendFollowUpMessage('Add me another widget');
    });

    expect(result.current.isUpdating).toBe(false);
  });
});
