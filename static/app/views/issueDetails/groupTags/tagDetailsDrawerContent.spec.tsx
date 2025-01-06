import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';
import {TagValuesFixture} from 'sentry-fixture/tagvalues';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {TagDetailsDrawerContent} from './tagDetailsDrawerContent';

const mockNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => mockNavigate,
}));

const group = GroupFixture();
const tags = TagsFixture();

function init(tagKey: string) {
  return initializeOrg({
    router: {
      location: {
        pathname: '/organizations/:orgId/issues/:groupId/',
        query: {},
      },
      params: {orgId: 'org-slug', groupId: group.id, tagKey},
    },
  });
}

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
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {router});

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
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
      headers: {
        Link:
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    render(<TagDetailsDrawerContent group={group} />, {router});

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({tagDrawerCursor: '0:100:0'}),
        })
      );
    });
  });

  it('navigates to issue details events tab with correct query params', async () => {
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {router});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Tag Value Actions Menu'})
    );
    await userEvent.click(
      await screen.findByRole('link', {name: 'View other events with this tag value'})
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/1/events/',
      query: {query: 'user.username:david'},
    });
  });

  it('navigates to discover with issue + tag query', async () => {
    const {router} = init('user');
    const discoverOrganization = OrganizationFixture({
      features: ['discover-basic'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<TagDetailsDrawerContent group={group} />, {
      router,
      organization: discoverOrganization,
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Tag Value Actions Menu'})
    );
    await userEvent.click(await screen.findByRole('link', {name: 'Open in Discover'}));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/discover/results/',
      query: {
        dataset: 'errors',
        field: ['title', 'release', 'environment', 'user.display', 'timestamp'],
        interval: '4h',
        name: 'RequestError: GET /issues/ 404',
        project: '2',
        query: 'issue:JAVASCRIPT-6QS user.username:david',
        statsPeriod: '14d',
        yAxis: ['count()', 'count_unique(user)'],
      },
    });
  });

  it('renders an error message if tag values request fails', async () => {
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      statusCode: 500,
    });

    render(<TagDetailsDrawerContent group={group} />, {router});

    expect(
      await screen.findByText('There was an error loading tag details')
    ).toBeInTheDocument();
  });
});
