import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {MERGED_ISSUES_DOCS_LINK} from 'sentry/views/issueDetails/groupMerged';
import {MergedIssuesDrawer} from 'sentry/views/issueDetails/groupMerged/mergedIssuesDrawer';

describe('MergedIssuesDrawer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture();
  const event = EventFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/hashes/`,
      body: [
        {
          latestEvent: event,
          id: '2c4887696f708c476a81ce4e834c4b02',
          mergedBySeer: true,
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
    expect(await screen.findByRole('link', {name: 'Learn more'})).toHaveAttribute(
      'href',
      MERGED_ISSUES_DOCS_LINK
    );
    expect(screen.getByText('Fingerprints included in this issue')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Close Drawer'})).toBeInTheDocument();
  });
});
