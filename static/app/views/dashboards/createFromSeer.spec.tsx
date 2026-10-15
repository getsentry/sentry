import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {decodeList} from 'sentry/utils/queryString';

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

function makeCompletedSession(scope: {environment?: string[]; projects?: number[]}) {
  const [userBlock, assistantBlock] = MOCKED_COMPLETED_SESSION.session.blocks;
  const artifact = assistantBlock!.artifacts[0]!;
  return {
    session: {
      ...MOCKED_COMPLETED_SESSION.session,
      blocks: [
        userBlock,
        {
          ...assistantBlock,
          artifacts: [{...artifact, data: {...artifact.data, ...scope}}],
        },
      ],
    },
  };
}

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
    features: ['dashboards-edit'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture()]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      method: 'GET',
      body: [],
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

  it('selects the projects Seer scoped the dashboard to', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '2', slug: 'project-slug', isMember: true}),
      ProjectFixture({id: '3', slug: 'other-project', isMember: false}),
    ]);
    MockApiClient.addMockResponse({
      url: SEER_API_URL,
      body: makeCompletedSession({projects: [3]}),
    });
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: {},
    });

    const {router} = render(<CreateFromSeer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/from-seer/',
          query: {seerRunId: String(SEER_RUN_ID)},
        },
      },
    });

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.location.query.project).toBe('3');
    });
    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalled();
    });
    for (const [, options] of eventsStatsMock.mock.calls) {
      expect(options.query.project).toEqual([3]);
    }
  });

  it('does not select other projects when Seer does not scope the dashboard', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '2', slug: 'project-slug', isMember: true}),
      ProjectFixture({id: '3', slug: 'other-project', isMember: false}),
    ]);
    MockApiClient.addMockResponse({
      url: SEER_API_URL,
      body: MOCKED_COMPLETED_SESSION,
    });

    const {router} = render(<CreateFromSeer />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/dashboards/from-seer/',
          query: {seerRunId: String(SEER_RUN_ID)},
        },
      },
    });

    expect(await screen.findByText('Test Dashboard')).toBeInTheDocument();
    expect(decodeList(router.location.query.project)).not.toContain('3');
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
