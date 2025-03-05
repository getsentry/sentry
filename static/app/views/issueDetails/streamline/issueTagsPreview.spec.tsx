import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    expect(screen.getByRole('link', {name: 'View all tags'})).toBeInTheDocument();
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

  it('renders tags edge case correctly with prefetching', async () => {
    const group = GroupFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [
        {
          topValues: [
            {
              count: 2,
              name: 'Chrome',
              value: 'Chrome',
              lastSeen: '2018-11-16T22:52:24Z',
              key: 'browser',
              firstSeen: '2018-05-06T03:48:28.855Z',
            },
            {
              count: 1,
              name: 'Firefox',
              value: 'Firefox',
              lastSeen: '2018-12-20T23:32:25Z',
              key: 'browser',
              firstSeen: '2018-12-20T23:32:43.811Z',
            },
          ],
          name: 'Browser',
          key: 'browser',
          totalValues: 3,
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/browser/values/`,
      body: [
        {
          count: 2,
          name: 'Chrome',
          value: 'Chrome',
          lastSeen: '2018-11-16T22:52:24Z',
          key: 'browser',
          firstSeen: '2018-05-06T03:48:28.855Z',
        },
        {
          count: 1,
          name: 'Firefox',
          value: 'Firefox',
          lastSeen: '2018-12-20T23:32:25Z',
          key: 'browser',
          firstSeen: '2018-12-20T23:32:43.811Z',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/browser/`,
      body: {
        topValues: [
          {
            count: 2,
            name: 'Chrome',
            value: 'Chrome',
            lastSeen: '2018-11-16T22:52:24Z',
            key: 'browser',
            firstSeen: '2018-05-06T03:48:28.855Z',
          },
          {
            count: 1,
            name: 'Firefox',
            value: 'Firefox',
            lastSeen: '2018-12-20T23:32:25Z',
            key: 'browser',
            firstSeen: '2018-12-20T23:32:43.811Z',
          },
        ],
        name: 'Browser',
        key: 'browser',
        totalValues: 3,
      },
    });

    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('Chrome')).toBeInTheDocument();
    expect(await screen.findByText('66%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Chrome'));
    expect(await screen.findByText('Firefox')).toBeInTheDocument(); // tooltip description
    expect(await screen.findByText('33%')).toBeInTheDocument();

    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });
});
