import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupTitleRow} from 'sentry/components/groupTitleRow';
import {EventOrGroupType} from 'sentry/types/event';

const organization = OrganizationFixture();

const group = GroupFixture({
  level: 'error',
  metadata: {
    type: 'metadata type',
    directive: 'metadata directive',
    uri: 'metadata uri',
    value: 'metadata value',
    message: 'metadata message',
  },
  culprit: 'culprit',
});

const baseIssuesPath = `/organizations/${organization.slug}/issues/`;

describe('GroupTitleRow', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('renders with `type = error`', () => {
    render(<GroupTitleRow data={group} />);

    expect(screen.getByText('metadata type')).toBeInTheDocument();
  });

  it('renders with `type = csp`', () => {
    render(
      <GroupTitleRow
        data={{
          ...group,
          type: EventOrGroupType.CSP,
        }}
      />
    );

    expect(screen.getByText('metadata directive')).toBeInTheDocument();
  });

  it('renders with `type = default`', () => {
    render(
      <GroupTitleRow
        data={{
          ...group,
          type: EventOrGroupType.DEFAULT,
          metadata: {
            ...group.metadata,
            title: 'metadata title',
          },
        }}
      />
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });

  it('renders metadata values in message for error events', () => {
    render(
      <GroupTitleRow
        data={{
          ...group,
          type: EventOrGroupType.ERROR,
        }}
      />
    );

    expect(screen.getByText('metadata value')).toBeInTheDocument();
  });

  it('preloads group on hover', async () => {
    jest.useFakeTimers();
    const mockFetchGroup = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });

    render(<GroupTitleRow data={group} />);

    const groupLink = screen.getByRole('link');

    // Should not be called right away
    await userEvent.hover(groupLink, {delay: null});
    expect(mockFetchGroup).not.toHaveBeenCalled();

    // Called after 300ms
    jest.advanceTimersByTime(301);
    expect(mockFetchGroup).toHaveBeenCalled();
  });

  it('hides level tag', () => {
    render(
      <GroupTitleRow
        hideLevel
        data={{
          ...group,
          type: EventOrGroupType.DEFAULT,
          metadata: {
            ...group.metadata,
            title: 'metadata title',
          },
        }}
      />
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });

  it('keeps sort in link when query has sort', () => {
    const groupDefault = GroupFixture({
      ...group,
      type: EventOrGroupType.DEFAULT,
    });

    render(<GroupTitleRow data={groupDefault} />, {
      initialRouterConfig: {
        location: {
          pathname: baseIssuesPath,
          query: {sort: 'freq'},
        },
      },
    });

    const href = screen.getByRole('link').getAttribute('href');
    expect(href).toBeTruthy();

    const url = new URL(`https://example${href}`);
    expect(url.pathname).toBe(`${baseIssuesPath}${groupDefault.id}/`);
    expect(url.searchParams.get('sort')).toBe('freq');
    expect(url.searchParams.get('_allp')).toBe('1');
    expect(url.searchParams.get('referrer')).toBe('event-or-group-header');
  });

  it('lack of project adds all parameter', () => {
    const groupDefault = GroupFixture({
      ...group,
      type: EventOrGroupType.DEFAULT,
    });

    render(<GroupTitleRow data={groupDefault} />);

    const href = screen.getByRole('link').getAttribute('href');
    expect(href).toBeTruthy();

    const url = new URL(`https://example${href}`);
    expect(url.pathname).toBe(`${baseIssuesPath}${groupDefault.id}/`);
    expect(url.searchParams.get('_allp')).toBe('1');
    expect(url.searchParams.get('referrer')).toBe('event-or-group-header');
  });

  it('renders group tombstone without link to group', () => {
    render(
      <GroupTitleRow
        data={{
          id: '123',
          level: 'error',
          culprit:
            'useOverflowTabs(webpack-internal:///./app/components/tabs/tabList.tsx)',
          type: EventOrGroupType.ERROR,
          metadata: {
            value: 'numTabItems is not defined',
            type: 'ReferenceError',
            filename: 'webpack-internal:///./app/components/tabs/tabList.tsx',
            function: 'useOverflowTabs',
          },
          actor: UserFixture(),
          isTombstone: true,
          dateAdded: '2025-06-25T00:00:00Z',
        }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
