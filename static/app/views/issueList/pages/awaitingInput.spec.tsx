import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {MemberFixture} from 'sentry-fixture/member';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TagStore} from 'sentry/stores/tagStore';

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
  const group = GroupFixture({id: '1', project});

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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-progress/',
      body: {results: {1: {progress: 'diagnosed'}}},
    });

    render(<AwaitingInputPage />);

    expect(await screen.findByText('Progress')).toBeInTheDocument();
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(await screen.findByText('Diagnosed')).toBeInTheDocument();
    expect(screen.getByText('RequestError')).toBeInTheDocument();
  });
});
