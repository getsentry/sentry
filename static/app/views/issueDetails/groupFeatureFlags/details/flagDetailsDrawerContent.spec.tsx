import {GroupFixture} from 'sentry-fixture/group';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Container} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';

import {FlagDetailsDrawerContent} from './flagDetailsDrawerContent';

jest.mock('sentry/utils/analytics');

const pageLinks =
  '<https://sentry.io/api/0/organizations/org-slug/flags/logs/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<https://sentry.io/api/0/organizations/org-slug/flags/logs/?cursor=0:50:0>; rel="next"; results="true"; cursor="0:50:0"';

describe('FlagDetailsDrawerContent', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      query: {flag: 'test-flag-key'},
      body: {
        data: [
          {
            id: '1',
            provider: 'test-provider',
            flag: 'test-flag-key',
            action: 'updated',
            createdAt: '2021-01-01T00:00:00Z',
          },
        ],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('renders a list of tag values', async () => {
    const group = GroupFixture();
    const {router} = render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Flag Name')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Displays dropdown menu
    await userEvent.hover(screen.getByText('test-flag-key'));
    expect(
      screen.getByRole('button', {name: 'Flag Audit Log Actions Menu'})
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'Flag Audit Log Actions Menu'})
    );
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Search issues where this flag value is FALSE',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Search issues where this flag value is TRUE',
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('menuitemradio', {name: 'Copy flag value to clipboard'})
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: 'Search issues where this flag value is TRUE',
      })
    );
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
    });
    expect(router.location.query).toEqual({
      query: 'flags[test-flag-key]:"true"',
    });
  });

  it('marks the Date column as sorted newest first', async () => {
    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    expect(await screen.findByRole('columnheader', {name: 'Date'})).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  });

  it('renders an issue first seen row before the first log older than the issue', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {
        data: [
          {
            id: '2',
            provider: 'newer-provider',
            flag: 'test-flag-key',
            action: 'updated',
            createdAt: '2021-03-01T00:00:00Z',
          },
          {
            id: '1',
            provider: 'older-provider',
            flag: 'test-flag-key',
            action: 'created',
            createdAt: '2021-01-01T00:00:00Z',
          },
        ],
      },
    });

    const group = GroupFixture({firstSeen: '2021-02-01T00:00:00Z'});
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    await screen.findByText('Issue First Seen');
    const rows = screen.getAllByRole('row');
    const [, newerRow, firstSeenRow, olderRow] = rows;
    const firstSeenCells = within(firstSeenRow!).getAllByRole('cell');

    expect(rows).toHaveLength(4);
    expect(newerRow).toHaveTextContent('newer-provider');
    expect(olderRow).toHaveTextContent('older-provider');
    expect(firstSeenCells).toHaveLength(5);
    expect(firstSeenCells[2]).toHaveTextContent('Issue First Seen');
    expect(firstSeenCells[3]).toHaveTextContent('Feb 1, 2021');
  });

  it('hides pagination while the audit logs are loading', async () => {
    let resolveRequest = () => {};
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {
        data: [
          {
            id: '1',
            provider: 'test-provider',
            flag: 'test-flag-key',
            action: 'updated',
            createdAt: '2021-01-01T00:00:00Z',
          },
        ],
      },
      headers: {Link: pageLinks},
      asyncDelay: new Promise<void>(resolve => {
        resolveRequest = resolve;
      }),
    });

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
    const nextButtonWhileLoading = screen.queryByRole('button', {name: 'Next'});
    resolveRequest();

    expect(nextButtonWhileLoading).not.toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('renders an error message without pagination if flag values request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      statusCode: 500,
      headers: {Link: pageLinks},
    });

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    expect(
      await screen.findByText('There was an error loading feature flag details.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('renders an empty state message if audit log values are empty', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {data: []},
      headers: {Link: pageLinks},
    });

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    expect(
      await screen.findByText('No audit logs were found for this feature flag.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'See all flags'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/distributions/?tab=featureFlags'
    );
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('navigates to the next page of audit logs when Next is clicked', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {
        data: [
          {
            id: '1',
            provider: 'test-provider',
            flag: 'test-flag-key',
            action: 'updated',
            createdAt: '2021-01-01T00:00:00Z',
          },
        ],
      },
      headers: {Link: pageLinks},
    });

    const group = GroupFixture();
    const {router} = render(
      <GroupDataContextProvider group={group} project={group.project}>
        <FlagDetailsDrawerContent group={group} />
      </GroupDataContextProvider>
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(router.location.query.flagDrawerCursor).toBe('0:50:0');
    });
    expect(trackAnalytics).toHaveBeenCalledWith(
      'flags.logs-paginated',
      expect.objectContaining({
        direction: 'next',
        organization: expect.objectContaining({slug: 'org-slug'}),
      })
    );
  });

  it('hides the Provider and Flag Name columns when the container is narrow', async () => {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400);

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <Container containerType="inline-size">
          <FlagDetailsDrawerContent group={group} />
        </Container>
      </GroupDataContextProvider>
    );

    const table = await screen.findByRole('table', {name: 'Feature flag audit logs'});
    const rules = getEmotionRules(table).join('');

    expect(rules).toContain("nth-child(1 of [role='cell'], [role='columnheader'])");
    expect(rules).toContain("nth-child(2 of [role='cell'], [role='columnheader'])");
    expect(rules).not.toContain("nth-child(3 of [role='cell'], [role='columnheader'])");
    expect(rules).not.toContain("nth-child(4 of [role='cell'], [role='columnheader'])");
  });

  it('hides only the Flag Name column when the container is medium', async () => {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(500);

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <Container containerType="inline-size">
          <FlagDetailsDrawerContent group={group} />
        </Container>
      </GroupDataContextProvider>
    );

    const table = await screen.findByRole('table', {name: 'Feature flag audit logs'});
    const rules = getEmotionRules(table).join('');

    expect(rules).toContain("nth-child(2 of [role='cell'], [role='columnheader'])");
    expect(rules).not.toContain("nth-child(1 of [role='cell'], [role='columnheader'])");
    expect(rules).not.toContain("nth-child(3 of [role='cell'], [role='columnheader'])");
    expect(rules).not.toContain("nth-child(4 of [role='cell'], [role='columnheader'])");
  });

  it('shows the Flag Name column when the container is wide', async () => {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);

    const group = GroupFixture();
    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <Container containerType="inline-size">
          <FlagDetailsDrawerContent group={group} />
        </Container>
      </GroupDataContextProvider>
    );

    const table = await screen.findByRole('table', {name: 'Feature flag audit logs'});

    expect(getEmotionRules(table).join('')).not.toContain('nth-child(');
  });
});
