import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ReplayReader} from 'sentry/utils/replays/replayReader';
import {ReplayDetailsProviders} from 'sentry/views/explore/replays/detail/body/replayDetailsProviders';

const startedAt = new Date('2023-12-25T00:00:00');

describe('ReplayDetailsProviders', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({id: '2', slug: 'project-slug'});

  let markAsViewedMock: jest.Mock;

  function makeReader() {
    return ReplayReader.factory({
      attachments: RRWebInitFrameEventsFixture({timestamp: startedAt}),
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture({
        id: 'test-replay-id',
        project_id: project.id,
        started_at: startedAt,
        has_viewed: false,
      }),
    })!;
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/replays/test-replay-id/viewed-by/',
      body: {viewed_by: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: {},
    });
    markAsViewedMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/replays/test-replay-id/viewed-by/',
      method: 'POST',
      body: {},
    });
  });

  it('marks the replay viewed once when the reader is rebuilt', async () => {
    const {rerender} = render(
      <ReplayDetailsProviders replay={makeReader()} projectSlug={project.slug}>
        <div>children</div>
      </ReplayDetailsProviders>,
      {organization}
    );
    await screen.findByText('children');

    rerender(
      <ReplayDetailsProviders replay={makeReader()} projectSlug={project.slug}>
        <div>children</div>
      </ReplayDetailsProviders>
    );
    await screen.findByText('children');

    expect(markAsViewedMock).toHaveBeenCalledTimes(1);
  });
});
