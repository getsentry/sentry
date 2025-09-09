import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {MergedIssuesDrawer} from 'sentry/views/issueDetails/groupMerged/mergedIssuesDrawer';

describe('MergedIssuesDrawer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture();
  const event = EventFixture();
  let mockMergedIssues: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    mockMergedIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/hashes/?limit=50&query=`,
      body: [
        {
          latestEvent: event,
          state: 'unlocked',
          id: '2c4887696f708c476a81ce4e834c4b02',
          metadata: {
            dateAdded: '2024-01-01T00:00:00Z',
            hashBasis: 'seer',
            hashingMetadata: {confidence: 0.95},
            latestGroupingConfig: 'v2',
            platform: 'javascript',
            schemaVersion: '1.1',
            seerDateSent: '2024-01-01T12:00:00Z',
            seerEventSent: 'event-456',
          },
        },
      ],
      method: 'GET',
    });
  });

  it('renders the content as expected', async () => {
    render(<MergedIssuesDrawer group={group} project={project} />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'Merged Issues'})
    ).toBeInTheDocument();
    expect(screen.getByText('Fingerprints included in this issue')).toBeInTheDocument();
    expect(mockMergedIssues).toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();
  });
});
