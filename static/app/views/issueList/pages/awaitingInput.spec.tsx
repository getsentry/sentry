import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TagStore} from 'sentry/stores/tagStore';
import {ProgressState} from 'sentry/types/group';

import AwaitingInputPage from './awaitingInput';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

describe('AwaitingInputPage', () => {
  const project = ProjectFixture({
    id: '3559',
    slug: 'project-slug',
    firstEvent: new Date().toISOString(),
  });
  const organization = OrganizationFixture({
    features: ['issue-stream-progress-ui'],
  });
  const group = GroupFixture({
    id: '1',
    project,
    derivedData: {
      progress: ProgressState.DIAGNOSED,
      status: 'open',
      viewCount: 0,
      hasOpenFixPr: false,
      isAssigned: false,
      hasRootCause: true,
      lastProgressedAt: null,
    },
  });

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'clientWidth', {value: 1000});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [group],
      headers: {Link: DEFAULT_LINKS_HEADER},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStatsFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body: [{}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: TagsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [MemberFixture({projects: [project.slug]})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/autofix/setup/`,
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/events/recommended/`,
      body: EventFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/external-issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/integrations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/pull-requests/`,
      body: {pullRequests: []},
    });

    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    TagStore.init?.();
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('displays progress column instead of priority', async () => {
    const progressRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-progress/',
      body: {results: {1: {progress: 'diagnosed'}}},
    });

    render(<AwaitingInputPage />, {organization});

    expect(await screen.findByText('RequestError')).toBeInTheDocument();
    const issueList = within(screen.getByTestId('issue-list'));
    expect(issueList.getByText('Progress')).toBeInTheDocument();
    expect(issueList.queryByText('Priority')).not.toBeInTheDocument();
    expect(await screen.findByText('Diagnosed')).toBeInTheDocument();
    expect(progressRequest).not.toHaveBeenCalled();
  });

  it('opens an issue preview drawer instead of navigating when an issue is clicked', async () => {
    const {router} = render(<AwaitingInputPage />, {organization});

    await userEvent.click(await screen.findByText('RequestError'), {skipHover: true});

    // Stays on the page and opens the drawer via the preview query param.
    expect(router.location.query.preview).toBe('1');
    expect(
      await screen.findByRole('complementary', {name: 'Issue preview'})
    ).toBeInTheDocument();
  });
});
