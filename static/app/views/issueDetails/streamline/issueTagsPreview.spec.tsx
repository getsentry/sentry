import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import IssueTagsPreview from './issueTagsPreview';

describe('IssueTagsPreview', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: [ProjectFixture()],
    });
  });
  it('renders preview tags', async () => {
    const group = GroupFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: TagsFixture(),
    });
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('prod')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'View issue tag distributions'})
    ).toBeInTheDocument();
  });

  it('renders no tags', async () => {
    const group = GroupFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(
      await screen.findByRole('button', {name: 'View issue tag distributions'})
    ).toBeInTheDocument();
  });
});
