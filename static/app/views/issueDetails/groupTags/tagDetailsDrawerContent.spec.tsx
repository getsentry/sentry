import * as qs from 'query-string';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';
import {TagValuesFixture} from 'sentry-fixture/tagvalues';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import type {TagValue, TagWithTopValues} from 'sentry/types/group';

import {TagDetailsDrawerContent} from './tagDetailsDrawerContent';

const group = GroupFixture();
const tags = TagsFixture();

const makeInitialRouterConfig = (tagKey: string) => ({
  location: {
    pathname: `/organizations/org-slug/issues/1/tags/${tagKey}/`,
    query: {},
  },
  route: '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
});

describe('TagDetailsDrawerContent', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      body: tags,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: GroupFixture(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a list of tag values', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();

    // Affected user column
    expect(screen.getByText('David Cramer')).toBeInTheDocument();
    expect(screen.getByText('17%')).toBeInTheDocument();
    // Count column
    expect(screen.getByText('3')).toBeInTheDocument();

    // Displays dropdown menu
    await userEvent.hover(screen.getByText('David Cramer'));
    expect(
      screen.getByRole('button', {name: 'Tag Value Actions Menu'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Tag Value Actions Menu'}));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Copy tag value to clipboard'})
    ).toBeInTheDocument();
  });

  it('can page through tag values', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
      headers: {
        Link:
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    const {router} = render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => {
      expect(router.location.query.tagDrawerCursor).toBe('0:100:0');
    });
  });

  it('navigates to issue details events tab with correct query params', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Tag Value Actions Menu'})
    );
    expect(
      screen.getByRole('menuitemradio', {
        name: 'View other events with this tag value',
      })
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/events/?query=user.username%3Adavid'
    );
  });

  it('navigates to discover with issue + tag query', async () => {
    const discoverOrganization = OrganizationFixture({
      features: ['discover-basic'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
      organization: discoverOrganization,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Tag Value Actions Menu'})
    );

    const discoverMenuItem = screen.getByRole('menuitemradio', {
      name: 'Open in Discover',
    });
    expect(discoverMenuItem).toBeInTheDocument();

    const link = new URL(discoverMenuItem.getAttribute('href') ?? '', 'http://localhost');
    expect(link.pathname).toBe('/organizations/org-slug/explore/discover/results/');
    const discoverQueryParams = qs.parse(link.search);

    expect(discoverQueryParams).toEqual({
      dataset: 'errors',
      field: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      interval: '1m',
      name: 'RequestError: GET /issues/ 404',
      project: '2',
      query: 'issue:JAVASCRIPT-6QS user.username:david',
      queryDataset: 'error-events',
      statsPeriod: '14d',
      yAxis: ['count()', 'count_unique(user)'],
    });
  });

  it('renders an error message if tag values request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      statusCode: 500,
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });

    expect(
      await screen.findByText('There was an error loading tag details')
    ).toBeInTheDocument();
  });

  it('renders rounded percentages counts [996, 4], total 1000', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: VariableTagFixture([996, 4], 1000),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: VariableTagValueFixture([996, 4]),
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Value and percent columns
    expect(screen.getByText('David Cramer 0')).toBeInTheDocument();
    expect(screen.getByText('>99%')).toBeInTheDocument(); // 996/1000 = 99.6% rounds to 100%, should show >99%
    expect(screen.getByText('David Cramer 1')).toBeInTheDocument();
    expect(screen.getByText('<1%')).toBeInTheDocument();

    // Count column
    expect(screen.getByText('996')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders rounded percentages counts [992, 7], total 1000', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: VariableTagFixture([992, 7], 1000),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: VariableTagValueFixture([992, 7]),
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Value and percent columns
    expect(screen.getByText('David Cramer 0')).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();
    expect(screen.getByText('David Cramer 1')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();

    // Count column
    expect(screen.getByText('992')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders rounded percentages counts [995, 5], total 1000', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: VariableTagFixture([995, 5], 1000),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: VariableTagValueFixture([995, 5]),
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Value and percent columns
    expect(screen.getByText('David Cramer 0')).toBeInTheDocument();
    expect(screen.getByText('>99%')).toBeInTheDocument();
    expect(screen.getByText('David Cramer 1')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();

    // Count column
    expect(screen.getByText('995')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('never displays 100% when there are multiple tag values', async () => {
    // Create a case where first item would round to 100% (997/1000 = 99.7%)
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: VariableTagFixture([997, 3], 1000),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: VariableTagValueFixture([997, 3]),
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Should show >99% instead of 100%
    expect(screen.getByText('David Cramer 0')).toBeInTheDocument();
    expect(screen.getByText('>99%')).toBeInTheDocument();
    expect(screen.getByText('David Cramer 1')).toBeInTheDocument();
    expect(screen.getByText('<1%')).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument(); // Should never show 100%

    // Count column
    expect(screen.getByText('997')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('falls back to tagValue.value when user has no identifiable fields', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: [
        {
          count: 5,
          firstSeen: '2024-01-01T00:00:00Z',
          lastSeen: '2024-01-01T00:00:00Z',
          name: '',
          value: 'id:123',
          key: 'user',
        },
      ],
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('user'),
    });

    expect(await screen.findByText('id:123')).toBeInTheDocument();
  });

  it('renders empty tag value label and hides copy action', async () => {
    const makeTopValue = (value: string, count: number) => ({
      count,
      name: value,
      value,
      key: 'device',
      lastSeen: '2024-01-01T00:00:00Z',
      firstSeen: '2024-01-01T00:00:00Z',
    });
    const makeTagValue = (value: string, count: number, id: string): TagValue => ({
      count,
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T00:00:00Z',
      name: value,
      value,
      key: 'device',
      id,
      email: '',
      username: '',
      ip_address: '',
    });

    const deviceTag: TagWithTopValues = {
      key: 'device',
      name: 'Device',
      totalValues: 8,
      uniqueValues: 2,
      topValues: [makeTopValue('', 5), makeTopValue('iPhone10', 3)],
    };
    const deviceValues: TagValue[] = [
      makeTagValue('', 5, '1'),
      makeTagValue('iPhone10', 3, '2'),
    ];

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      body: [deviceTag],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/device/',
      body: deviceTag,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/device/values/',
      body: deviceValues,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: group,
    });

    render(<TagDetailsDrawerContent group={group} />, {
      initialRouterConfig: makeInitialRouterConfig('device'),
    });

    expect(await screen.findByText('(empty)')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('(empty)'));
    const actionButtons = await screen.findAllByRole('button', {
      name: 'Tag Value Actions Menu',
    });
    await userEvent.click(actionButtons[0]!);

    const viewEventsMenuItem = screen.getByRole('menuitemradio', {
      name: 'View other events with this tag value',
    });
    const viewEventsUrl = new URL(
      viewEventsMenuItem.getAttribute('href') ?? '',
      'http://localhost'
    );
    expect(viewEventsUrl.pathname).toBe('/organizations/org-slug/issues/1/events/');
    expect(viewEventsUrl.searchParams.get('query')).toBe('!has:device');
    expect(viewEventsUrl.searchParams.get('referrer')).toBe('tag-details-drawer');
    expect(
      screen.queryByRole('menuitemradio', {name: 'Copy tag value to clipboard'})
    ).not.toBeInTheDocument();
  });
});

function VariableTagFixture(topValues: number[], totalValues: number): TagWithTopValues {
  return {
    topValues: topValues.map((count, index) => ({
      count,
      name: `david${index}`,
      value: `username:david${index}`,
      lastSeen: '2018-12-20T23:32:25Z',
      key: 'user',
      query: 'user.username:david',
      firstSeen: '2018-10-03T03:40:05.627Z',
    })),
    uniqueValues: topValues.length + 1,
    name: 'User',
    key: 'user',
    totalValues,
  };
}

function VariableTagValueFixture(counts: number[]): TagValue[] {
  return counts.map((count, index) => ({
    count,
    username: `david${index}`,
    name: `David Cramer ${index}`,
    value: `username:david${index}`,
    id: '10799',
    lastSeen: '2018-12-20T23:32:25Z',
    firstSeen: '2018-10-03T03:40:05.627Z',
    email: 'david@example.com',
    ip_address: '0.0.0.0',
  }));
}
