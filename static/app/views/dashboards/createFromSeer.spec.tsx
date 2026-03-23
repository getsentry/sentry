import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import CreateFromSeer from './createFromSeer';

const SEER_RUN_ID = 123;
const SEER_API_URL = `/organizations/org-slug/seer/explorer-chat/${SEER_RUN_ID}/`;

const MOCKED_COMPLETED_SESSION = {
  session: {
    run_id: SEER_RUN_ID,
    status: 'completed',
    updated_at: new Date().toISOString(),
    blocks: [
      {
        id: 'block-1',
        message: {content: 'Build me a dashboard', role: 'user'},
        timestamp: new Date().toISOString(),
        artifacts: [],
      },
      {
        id: 'block-2',
        message: {content: 'Here is your dashboard', role: 'assistant'},
        timestamp: new Date().toISOString(),
        artifacts: [
          {
            key: 'dashboard',
            reason: 'generated',
            data: {
              title: 'Test Dashboard',
              widgets: [
                {
                  title: 'Error Count',
                  display_type: 'line',
                  widget_type: 'discover',
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
                  layout: {x: 0, y: 0, w: 4, h: 2, min_h: 2},
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

const MOCKED_PROCESSING_SESSION = {
  session: {
    run_id: SEER_RUN_ID,
    status: 'processing',
    updated_at: new Date().toISOString(),
    blocks: [],
  },
};

describe('CreateFromSeer', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-edit', 'dashboards-ai-generate'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture()]);

    MockApiClient.addMockResponse({url: '/organizations/org-slug/tags/', body: []});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      body: {},
    });
  });

  it('shows loading state while session is processing', () => {
    MockApiClient.addMockResponse({
      url: SEER_API_URL,
      body: MOCKED_PROCESSING_SESSION,
    });

    render(<CreateFromSeer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/from-seer/',
          query: {seerRunId: String(SEER_RUN_ID)},
        },
      },
    });

    expect(
      screen.getByRole('heading', {name: 'Generating Dashboard'})
    ).toBeInTheDocument();
  });

  it('renders dashboard and chat panel when session is completed', async () => {
    MockApiClient.addMockResponse({
      url: SEER_API_URL,
      body: MOCKED_COMPLETED_SESSION,
    });

    render(<CreateFromSeer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/from-seer/',
          query: {seerRunId: String(SEER_RUN_ID)},
        },
      },
    });

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText('Ask Seer to modify this dashboard...')
    ).toBeInTheDocument();
  });

  it('sends user input message to seer through the chat panel', async () => {
    MockApiClient.addMockResponse({
      url: SEER_API_URL,
      body: MOCKED_COMPLETED_SESSION,
    });

    const postMock = MockApiClient.addMockResponse({
      url: SEER_API_URL,
      method: 'POST',
      body: {},
    });

    render(<CreateFromSeer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/from-seer/',
          query: {seerRunId: String(SEER_RUN_ID)},
        },
      },
    });

    const textarea = await screen.findByPlaceholderText(
      'Ask Seer to modify this dashboard...'
    );
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Add an error rate widget{Enter}');

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        SEER_API_URL,
        expect.objectContaining({
          method: 'POST',
          data: {query: 'Add an error rate widget'},
        })
      );
    });
  });
});
