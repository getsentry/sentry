import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  it('displays the extra data sections as closed by default', async function () {
    render(<IssueContent group={group} project={project} />, {organization});

    const mergedIssues = await screen.findByText('Merged Issues');
    expect(mergedIssues).toBeInTheDocument();
    expect(
      screen.queryByText('Fingerprints included in this issue')
    ).not.toBeInTheDocument();
    await userEvent.click(mergedIssues);
    expect(screen.getByText('Fingerprints included in this issue')).toBeInTheDocument();
    expect(mockMergedIssues).toHaveBeenCalled();

    const similarIssues = await screen.findByText('Similar Issues');
    expect(similarIssues).toBeInTheDocument();
    expect(
      screen.queryByText('Issues with a similar stack trace')
    ).not.toBeInTheDocument();
    await userEvent.click(similarIssues);
    expect(screen.getByText('Issues with a similar stack trace')).toBeInTheDocument();
    expect(mockSimilarIssues).toHaveBeenCalled();
  });
});
