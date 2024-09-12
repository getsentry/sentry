import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueContent} from 'sentry/views/issueDetails/streamline/issueContent';

describe('IssueContent', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({features: ['similarity-view']});
  const group = GroupFixture();
  const event = EventFixture();

  let mockMergedIssues;
  let mockSimilarIssues;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockMergedIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/hashes/?limit=50&query=`,
      body: [
        {
          latestEvent: event,
          state: 'unlocked',
          id: '2c4887696f708c476a81ce4e834c4b02',
        },
      ],
      method: 'GET',
    });
    mockSimilarIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.id}/issues/${group.id}/similar/?limit=50`,
      body: [[group, {'exception:stacktrace:pairs': 0.375}]],
      method: 'GET',
    });
  });

  it('displays the extra data sections', async function () {
    render(<IssueContent group={group} project={project} />, {organization});
    expect(await screen.findByText('Merged Issues')).toBeInTheDocument();
    expect(screen.getByText('Fingerprints included in this issue')).toBeInTheDocument();
    expect(mockMergedIssues).toHaveBeenCalled();
    expect(await screen.findByText('Similar Issues')).toBeInTheDocument();
    expect(screen.getByText('Issues with a similar stack trace')).toBeInTheDocument();
    expect(mockSimilarIssues).toHaveBeenCalled();
  });
});
