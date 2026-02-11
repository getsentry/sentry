import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueTagsPreview from './issueTagsPreview';

describe('IssueTagsPreview', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
      screen.getByRole('link', {name: 'View all tags and feature flags'})
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

  it('renders tag distribution topValues [2, 1], totalValues 3', async () => {
    const group = GroupFixture();
    mockTagResponses(group.id, [2, 1], 3);
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('Chrome0')).toBeInTheDocument();
    expect(await screen.findByText('67%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Chrome0')); // trigger tooltip
    expect(await screen.findByText('Chrome1')).toBeInTheDocument();
    expect(await screen.findByText('33%')).toBeInTheDocument();

    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('renders tag distribution topValues [500, 490, 5], totalValues 1000', async () => {
    const group = GroupFixture();
    mockTagResponses(group.id, [500, 490, 5], 1000);
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('Chrome0')).toBeInTheDocument();
    expect(await screen.findByText('50%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Chrome0')); // trigger tooltip
    expect(await screen.findByText('Chrome1')).toBeInTheDocument();
    expect(await screen.findByText('49%')).toBeInTheDocument();
    expect(await screen.findByText('Chrome2')).toBeInTheDocument();
    expect(await screen.findByText('1%')).toBeInTheDocument();
    expect(await screen.findByText('Other')).toBeInTheDocument();
    expect(await screen.findByText('<1%')).toBeInTheDocument();
  });

  it('renders tag distribution topValues [500, 490, 3], totalValues 1000', async () => {
    const group = GroupFixture();
    mockTagResponses(group.id, [500, 490, 3], 1000);
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('Chrome0')).toBeInTheDocument();
    expect(await screen.findByText('50%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Chrome0')); // trigger tooltip
    expect(await screen.findByText('Chrome1')).toBeInTheDocument();
    expect(await screen.findByText('49%')).toBeInTheDocument();
    expect(await screen.findByText('Chrome2')).toBeInTheDocument();
    expect(await screen.findByText('<1%')).toBeInTheDocument();
    expect(await screen.findByText('Other')).toBeInTheDocument();
    expect(await screen.findByText('1%')).toBeInTheDocument();
  });

  it('renders tag distribution topValues [500, 480, 15], totalValues 1000', async () => {
    const group = GroupFixture();
    mockTagResponses(group.id, [500, 480, 15], 1000);
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('Chrome0')).toBeInTheDocument();
    expect(await screen.findByText('50%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Chrome0')); // trigger tooltip
    expect(await screen.findByText('Chrome1')).toBeInTheDocument();
    expect(await screen.findByText('48%')).toBeInTheDocument();
    expect(await screen.findByText('Chrome2')).toBeInTheDocument();
    expect(await screen.findByText('2%')).toBeInTheDocument();
    expect(await screen.findByText('Other')).toBeInTheDocument();
    expect(await screen.findByText('<1%')).toBeInTheDocument();
  });

  it('renders (empty) label when tag value name is blank', async () => {
    const group = GroupFixture();
    mockTagResponses(group.id, [2, 1], 3, ['', 'Chrome1']);
    render(
      <IssueTagsPreview groupId={group.id} environments={[]} project={group.project} />
    );

    expect(await screen.findByText('(empty)')).toBeInTheDocument();
    expect(await screen.findByText('67%')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('(empty)'));
    expect(await screen.findByText('Chrome1')).toBeInTheDocument();
    expect(await screen.findByText('33%')).toBeInTheDocument();
  });
});

function mockTagResponses(
  groupId: string,
  topValues: number[],
  totalValues: number,
  valueNames?: string[]
) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/tags/`,
    body: [
      {
        topValues: topValues.map((count, index) => ({
          count,
          name: valueNames?.[index] ?? `Chrome${index}`,
          value: valueNames?.[index] ?? `Chrome${index}`,
          lastSeen: '2018-11-16T22:52:24Z',
          key: 'browser',
          firstSeen: '2018-05-06T03:48:28.855Z',
        })),
        name: 'Browser',
        key: 'browser',
        totalValues,
      },
    ],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/tags/browser/values/`,
    body: topValues.map((count, index) => ({
      count,
      name: valueNames?.[index] ?? `Chrome${index}`,
      value: valueNames?.[index] ?? `Chrome${index}`,
      lastSeen: '2018-11-16T22:52:24Z',
      key: 'browser',
      firstSeen: '2018-05-06T03:48:28.855Z',
    })),
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/tags/browser/`,
    body: {
      topValues: topValues.map((count, index) => ({
        count,
        name: valueNames?.[index] ?? `Chrome${index}`,
        value: valueNames?.[index] ?? `Chrome${index}`,
        lastSeen: '2018-11-16T22:52:24Z',
        key: 'browser',
        firstSeen: '2018-05-06T03:48:28.855Z',
      })),
      name: 'Browser',
      key: 'browser',
      totalValues,
    },
  });
}
