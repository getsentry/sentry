import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {InboxItemFixture} from 'sentry-fixture/inboxItem';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import Inbox from 'sentry/views/inbox';
import {InvestigationDetailFixture} from 'sentry/views/investigations/fixtures';

import type {InboxSubject} from './types';

const INBOX_ROUTES = [
  '/organizations/:orgId/inbox/',
  '/organizations/:orgId/inbox/issue/:id/',
  '/organizations/:orgId/inbox/notebook/:id/',
];

const NEXT_CURSOR = '2020-01-01T00:00:00+00:00|3:0:0';

function mockIssuePreviewRequests(groupId: string) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/`,
    body: GroupFixture({id: groupId, metadata: {type: 'TypeError'}}),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/events/recommended/`,
    body: EventFixture({id: 'event-id'}),
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/events/event-id/owners/',
    body: {owners: [], rules: []},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/first-last-release/`,
    body: {firstRelease: null, lastRelease: null},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/integrations/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/external-issues/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/sentry-app-components/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/sentry-app-installations/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/pull-requests/`,
    body: {pullRequests: []},
  });
}

describe('Inbox', () => {
  const organization = OrganizationFixture({features: ['universal-inbox']});

  const issueItem = InboxItemFixture({
    id: '1',
    subjectType: 'issue',
    subjectId: '7656018581',
    title: "TypeError: Cannot read properties of undefined (reading 'id')",
  });
  const notebookItem = InboxItemFixture({
    id: '2',
    subjectType: 'notebook',
    subjectId: '1000210',
    title: 'OperationalError: could not connect to server',
    latestEvent: {
      id: '2',
      type: 'notebook.user_mentioned',
      actor: {type: 'user', id: '2', name: 'Jane Doe', avatar: null},
      data: {blockId: null, commentId: '1'},
      summary: 'Mentioned you in a comment',
      isUnread: true,
      dateAdded: '2020-01-01T00:00:00.000Z',
    },
  });
  const readNotebookItem = InboxItemFixture({
    id: '3',
    subjectType: 'notebook',
    subjectId: '1000209',
    title: 'Checkout latency regression',
    isUnread: false,
    unreadEventCount: 0,
  });

  let markReadRequest: jest.Mock;

  async function expectMarkedRead(subject: InboxSubject) {
    await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(1));
    expect(markReadRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/inbox/',
      expect.objectContaining({
        method: 'PUT',
        query: {subject_type: [subject.subjectType], subject_id: subject.subjectId},
        data: {isRead: true},
      })
    );
  }

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [issueItem, notebookItem, readNotebookItem],
    });
    markReadRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      method: 'PUT',
      body: {updatedCount: 1},
    });
  });

  it('shows the title and latest event summary of each item', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [notebookItem, InboxItemFixture({id: '4', title: null})],
    });

    render(<Inbox />, {organization});

    expect(
      await screen.findByRole('link', {
        name: /OperationalError: could not connect to server/,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Mentioned you in a comment')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Unavailable/})).toBeInTheDocument();
  });

  it('shows an empty state when there are no items', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [],
    });

    render(<Inbox />, {organization});

    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument();
  });

  it('shows an error state when items fail to load', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<Inbox />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('loads more items', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [issueItem, notebookItem],
      headers: {
        Link: `<http://localhost/?cursor=${encodeURIComponent(NEXT_CURSOR)}>; rel="next"; results="true"; cursor="${NEXT_CURSOR}"`,
      },
    });
    const nextPageRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      match: [MockApiClient.matchQuery({cursor: NEXT_CURSOR})],
      body: [readNotebookItem],
    });

    render(<Inbox />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Show more'}));

    expect(
      await screen.findByRole('link', {name: /Checkout latency regression/})
    ).toBeInTheDocument();
    expect(nextPageRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', {name: 'Show more'})).not.toBeInTheDocument();
  });

  it('selects an item from the list', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    const item = await screen.findByRole('link', {
      name: /OperationalError: could not connect to server/,
    });
    expect(item).not.toHaveAttribute('aria-current');

    await userEvent.click(item);

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/inbox/notebook/1000210/'
    );
    expect(item).toHaveAttribute('aria-current', 'true');
    await expectMarkedRead(notebookItem);
  });

  it('previews the selected item', async () => {
    const detailUrl = '/organizations/org-slug/notebooks/1000210/';
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        id: '1000210',
        title: 'OperationalError: could not connect to server',
      }),
    });
    MockApiClient.addMockResponse({url: `${detailUrl}comments/`, body: []});
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });

    render(<Inbox />, {
      organization: OrganizationFixture({
        features: ['universal-inbox', 'investigations'],
        openMembership: true,
      }),
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByText('No item selected')).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole('link', {
        name: /OperationalError: could not connect to server/,
      })
    );

    expect(await screen.findByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      'OperationalError: could not connect to server'
    );
  });

  it('does not carry query params between items', async () => {
    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/inbox/',
          query: {project: '1', environment: 'production'},
        },
        routes: INBOX_ROUTES,
      },
    });

    expect(
      await screen.findByRole('link', {
        name: /OperationalError: could not connect to server/,
      })
    ).toHaveAttribute('href', '/organizations/org-slug/inbox/notebook/1000210/');
  });

  it('selects the item for the issue in the url', async () => {
    mockIssuePreviewRequests('7656018581');

    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/issue/7656018581/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: /TypeError: Cannot read properties/})
    ).toHaveAttribute('aria-current', 'true');
    await expectMarkedRead(issueItem);
  });

  it('previews the issue in the url when it is not in the loaded items', async () => {
    mockIssuePreviewRequests('9999');

    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/issue/9999/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: /TypeError: Cannot read properties/})
    ).not.toHaveAttribute('aria-current');
    await expectMarkedRead({subjectType: 'issue', subjectId: '9999'});
  });

  it('marks an item outside the loaded page and filters as read', async () => {
    mockIssuePreviewRequests(issueItem.subjectId);
    const listRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [notebookItem],
      headers: {
        Link: `<http://localhost/?cursor=${encodeURIComponent(NEXT_CURSOR)}>; rel="next"; results="true"; cursor="${NEXT_CURSOR}"`,
      },
    });
    const nextPageRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      match: [MockApiClient.matchQuery({cursor: NEXT_CURSOR})],
      body: [issueItem],
    });

    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/org-slug/inbox/issue/${issueItem.subjectId}/`,
          query: {subjectType: 'notebook'},
        },
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
    await expectMarkedRead(issueItem);
    expect(listRequest).toHaveBeenCalledTimes(1);
    expect(nextPageRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Show more'})).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: /TypeError: Cannot read properties/})
    ).not.toBeInTheDocument();
  });

  it('does not mark an item that is already read', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/notebooks/1000209/',
      body: InvestigationDetailFixture({id: '1000209'}),
    });

    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/notebook/1000209/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(
      await screen.findByRole('link', {name: /Checkout latency regression/})
    ).toHaveAttribute('aria-current', 'true');
    expect(markReadRequest).not.toHaveBeenCalled();
  });

  it('does not mark items as read without viewing them', async () => {
    render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    expect(await screen.findByText('No item selected')).toBeInTheDocument();
    expect(markReadRequest).not.toHaveBeenCalled();
  });

  it('selects items with checkboxes without opening them', async () => {
    const {router} = render(<Inbox />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/inbox/'},
        routes: INBOX_ROUTES,
      },
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Select OperationalError: could not connect to server',
    });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(
      screen.getByRole('checkbox', {name: 'Select Checkout latency regression'})
    ).not.toBeChecked();
    expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

    await userEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
  });

  describe('individual actions', () => {
    it('marks only that item as read without opening it', async () => {
      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      const selectedCheckbox = await screen.findByRole('checkbox', {
        name: `Select ${notebookItem.title}`,
      });
      await userEvent.click(selectedCheckbox);
      const actions = screen.getByRole('button', {
        name: `Actions for ${issueItem.title}`,
      });
      await userEvent.hover(actions);
      await userEvent.click(actions);
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mark as read'})
      );

      await waitFor(() =>
        expect(markReadRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/inbox/',
          expect.objectContaining({
            method: 'PUT',
            query: {id: [issueItem.id]},
            data: {isRead: true},
          })
        )
      );
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(1);
      expect(selectedCheckbox).toBeChecked();
      expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

      await userEvent.click(actions);
      expect(
        await screen.findByRole('menuitemradio', {name: 'Mark as unread'})
      ).toBeInTheDocument();
    });

    it('marks only that item as unread without opening it', async () => {
      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      const selectedCheckbox = await screen.findByRole('checkbox', {
        name: `Select ${notebookItem.title}`,
      });
      await userEvent.click(selectedCheckbox);
      const actions = screen.getByRole('button', {
        name: `Actions for ${readNotebookItem.title}`,
      });
      await userEvent.hover(actions);
      await userEvent.click(actions);
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mark as unread'})
      );

      await waitFor(() =>
        expect(markReadRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/inbox/',
          expect.objectContaining({
            method: 'PUT',
            query: {id: [readNotebookItem.id]},
            data: {isRead: false},
          })
        )
      );
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(3);
      expect(selectedCheckbox).toBeChecked();
      expect(router.location.pathname).toBe('/organizations/org-slug/inbox/');

      await userEvent.click(actions);
      expect(
        await screen.findByRole('menuitemradio', {name: 'Mark as read'})
      ).toBeInTheDocument();
    });

    it('keeps the open item unread when explicitly marked unread', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/notebooks/1000209/',
        body: InvestigationDetailFixture({id: '1000209'}),
      });
      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/notebook/1000209/'},
          routes: INBOX_ROUTES,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {
          name: `Actions for ${readNotebookItem.title}`,
        })
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mark as unread'})
      );

      await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(1));
      expect(markReadRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({query: {id: ['3']}, data: {isRead: false}})
      );
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(3);
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/inbox/notebook/1000209/'
      );
    });

    it('waits for auto-mark-read before sending an explicit mark-unread update', async () => {
      mockIssuePreviewRequests(issueItem.subjectId);
      const readResponse = Promise.withResolvers<void>();
      const autoReadRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        method: 'PUT',
        match: [MockApiClient.matchData({isRead: true})],
        body: {updatedCount: 1},
        asyncDelay: readResponse.promise,
      });
      render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/org-slug/inbox/issue/${issueItem.subjectId}/`,
          },
          routes: INBOX_ROUTES,
        },
      });

      await waitFor(() => expect(autoReadRequest).toHaveBeenCalledTimes(1));
      const actions = screen.getByRole('button', {
        name: `Actions for ${issueItem.title}`,
      });
      await userEvent.click(actions);
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mark as unread'})
      );

      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(2);
      expect(markReadRequest).not.toHaveBeenCalled();

      await act(() => {
        readResponse.resolve();
        return readResponse.promise;
      });

      await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(1));
      expect(markReadRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({query: {id: [issueItem.id]}, data: {isRead: false}})
      );
      await waitFor(() => expect(actions).toBeEnabled());
      await userEvent.click(actions);
      expect(
        await screen.findByRole('menuitemradio', {name: 'Mark as read'})
      ).toBeInTheDocument();
    });

    it('marks an explicitly unread item read when reopened after viewing another item', async () => {
      mockIssuePreviewRequests(issueItem.subjectId);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/notebooks/1000209/',
        body: InvestigationDetailFixture({id: '1000209'}),
      });
      render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/notebook/1000209/'},
          routes: INBOX_ROUTES,
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {
          name: `Actions for ${readNotebookItem.title}`,
        })
      );
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mark as unread'})
      );
      await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(1));
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(3);

      await userEvent.click(screen.getByRole('link', {name: issueItem.title!}));
      await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(2));
      await userEvent.click(screen.getByRole('link', {name: readNotebookItem.title!}));

      await waitFor(() => expect(markReadRequest).toHaveBeenCalledTimes(3));
      expect(markReadRequest).toHaveBeenLastCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({
          query: {subject_type: ['notebook'], subject_id: readNotebookItem.subjectId},
          data: {isRead: true},
        })
      );
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(1);
    });

    it('removes only that item and lets you undo the removal', async () => {
      const removeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        method: 'DELETE',
        statusCode: 204,
      });
      render(<Inbox />, {organization});

      const actions = await screen.findByRole('button', {
        name: `Actions for ${notebookItem.title}`,
      });
      await userEvent.click(
        screen.getByRole('checkbox', {name: `Select ${notebookItem.title}`})
      );
      await userEvent.click(
        screen.getByRole('checkbox', {name: `Select ${issueItem.title}`})
      );
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        body: [issueItem, readNotebookItem],
      });
      await userEvent.click(actions);
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Remove'}));

      await waitFor(() =>
        expect(removeRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/inbox/',
          expect.objectContaining({method: 'DELETE', query: {id: ['2']}})
        )
      );
      expect(
        screen.queryByRole('link', {name: notebookItem.title!})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', {name: issueItem.title!})).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', {name: `Select ${issueItem.title}`})
      ).toBeChecked();
      expect(await screen.findByText('Removed 1 item')).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        body: [issueItem, notebookItem, readNotebookItem],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Undo'}));

      expect(markReadRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({
          method: 'PUT',
          query: {id: ['2']},
          data: {undoRemoval: true},
        })
      );
      expect(
        await screen.findByRole('link', {name: notebookItem.title!})
      ).toBeInTheDocument();
    });

    it('shows an error and restores the item when removal fails', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        method: 'DELETE',
        statusCode: 500,
      });
      render(<Inbox />, {organization});

      await userEvent.click(
        await screen.findByRole('button', {name: `Actions for ${notebookItem.title}`})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Remove'}));

      expect(await screen.findByText('Unable to remove item')).toBeInTheDocument();
      expect(
        await screen.findByRole('link', {name: notebookItem.title!})
      ).toBeInTheDocument();
    });
  });

  describe('bulk actions', () => {
    function renderInbox() {
      return render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });
    }

    it('selects and deselects all items', async () => {
      renderInbox();

      const selectAll = await screen.findByRole('checkbox', {name: 'Select all'});
      await screen.findByRole('link', {name: /Checkout latency regression/});
      expect(
        screen.queryByRole('button', {name: 'Mark as read'})
      ).not.toBeInTheDocument();

      await userEvent.click(selectAll);

      expect(selectAll).toBeChecked();
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', {name: 'Select Checkout latency regression'})
      ).toBeChecked();
      expect(screen.getByRole('button', {name: 'Mark as read'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Remove'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Filter'})).not.toBeInTheDocument();

      await userEvent.click(selectAll);

      expect(selectAll).not.toBeChecked();
      expect(
        screen.queryByRole('button', {name: 'Mark as read'})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Filter'})).toBeInTheDocument();
    });

    it('marks the selected items as read', async () => {
      renderInbox();

      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Select OperationalError: could not connect to server',
        })
      );
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(2);

      await userEvent.click(screen.getByRole('button', {name: 'Mark as read'}));

      expect(markReadRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({method: 'PUT', query: {id: ['2']}, data: {isRead: true}})
      );
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(1);
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });

    it('removes all selected items', async () => {
      const removeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        method: 'DELETE',
        statusCode: 204,
      });
      renderInbox();

      await screen.findByRole('link', {name: /Checkout latency regression/});
      MockApiClient.addMockResponse({url: '/organizations/org-slug/inbox/', body: []});
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      expect(removeRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/inbox/',
        expect.objectContaining({method: 'DELETE', query: {id: ['1', '2', '3']}})
      );
      expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument();
      expect(await screen.findByText('Removed 3 items')).toBeInTheDocument();
    });

    it('shows the remaining items after removing every loaded item', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        method: 'DELETE',
        statusCode: 204,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        body: [issueItem, notebookItem],
        headers: {
          Link: `<http://localhost/?cursor=${encodeURIComponent(NEXT_CURSOR)}>; rel="next"; results="true"; cursor="${NEXT_CURSOR}"`,
        },
      });
      renderInbox();

      await screen.findByRole('link', {name: /TypeError: Cannot read properties/});
      // The first page is refetched after the removal and now starts with the next item
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        body: [readNotebookItem],
      });
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

      expect(
        await screen.findByRole('link', {name: /Checkout latency regression/})
      ).toBeInTheDocument();
      expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', {name: /TypeError: Cannot read properties/})
      ).not.toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('filters by team recipient and removes the filter', async () => {
      const filteredRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [MockApiClient.matchQuery({recipient: ['team']})],
        body: [notebookItem],
      });

      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
      await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Recipient'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Team'}));
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Escape}');

      expect(
        await screen.findByRole('link', {name: notebookItem.title!})
      ).toBeInTheDocument();
      expect(filteredRequest).toHaveBeenCalled();
      expect(router.location.query).toEqual({recipient: 'team'});
      expect(
        screen.queryByRole('link', {name: /TypeError: Cannot read properties/})
      ).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Remove Recipient filter'})
      );

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(router.location.query).toEqual({});
    });

    it('filters by subject', async () => {
      const filteredRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [MockApiClient.matchQuery({subject_type: ['notebook']})],
        body: [notebookItem, readNotebookItem],
      });

      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
      await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Subject'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Investigation'}));

      await waitFor(() => expect(filteredRequest).toHaveBeenCalled());
      expect(
        await screen.findByRole('link', {name: /Checkout latency regression/})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', {name: /TypeError: Cannot read properties/})
      ).not.toBeInTheDocument();
      expect(router.location.query).toEqual({subjectType: 'notebook'});
      expect(
        screen.getByRole('button', {name: 'Remove Subject filter'})
      ).toBeInTheDocument();
    });

    it('filters by multiple notification types', async () => {
      const filteredRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [
          MockApiClient.matchQuery({
            event_type: [
              'issue.user_assigned',
              'notebook.user_mentioned',
              'notebook.team_mentioned',
            ],
          }),
        ],
        body: [issueItem, notebookItem],
      });

      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Filter'}));
      await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Type'}));
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Issue assigned to you'})
      );
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Investigation mentioned you'})
      );
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Investigation mentioned your team'})
      );

      await waitFor(() => expect(filteredRequest).toHaveBeenCalled());
      expect(router.location.query).toEqual({
        eventType: [
          'issue.user_assigned',
          'notebook.user_mentioned',
          'notebook.team_mentioned',
        ],
      });
      expect(screen.getByText('Issue assigned to you +2')).toBeInTheDocument();
    });

    it('loads filters from the url and removes them', async () => {
      const filteredRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [MockApiClient.matchQuery({subject_type: ['notebook']})],
        body: [notebookItem],
      });

      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/inbox/',
            query: {subjectType: 'notebook'},
          },
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {
          name: /OperationalError: could not connect to server/,
        })
      ).toBeInTheDocument();
      expect(filteredRequest).toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', {name: 'Remove Subject filter'}));

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(router.location.query).toEqual({});
    });

    it('marks a viewed item as read in lists for other filters', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [MockApiClient.matchQuery({subject_type: ['notebook']})],
        body: [notebookItem, readNotebookItem],
      });

      render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/inbox/'},
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(2);

      await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
      await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Subject'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Investigation'}));
      await waitFor(() =>
        expect(
          screen.queryByRole('link', {name: /TypeError: Cannot read properties/})
        ).not.toBeInTheDocument()
      );

      await userEvent.click(
        screen.getByRole('link', {name: /OperationalError: could not connect to server/})
      );
      await expectMarkedRead(notebookItem);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        body: [issueItem, {...notebookItem, isUnread: false}, readNotebookItem],
      });
      await userEvent.click(screen.getByRole('button', {name: 'Remove Subject filter'}));

      // The cached unfiltered list is shown before it is refetched
      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(screen.getAllByTestId('unread-inbox-item-indicator')).toHaveLength(1);
      expect(markReadRequest).toHaveBeenCalledTimes(1);
    });

    it('shows an empty state when no items match the filters', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [MockApiClient.matchQuery({event_type: ['issue.user_assigned']})],
        body: [],
      });

      const {router} = render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/inbox/',
            query: {eventType: 'issue.user_assigned'},
          },
          routes: INBOX_ROUTES,
        },
      });

      expect(await screen.findByText('No items match these filters')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(router.location.query).toEqual({});
    });

    it('keeps filters in item links', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [
          MockApiClient.matchQuery({subject_type: ['notebook'], recipient: ['team']}),
        ],
        body: [notebookItem],
      });

      render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/inbox/',
            query: {subjectType: 'notebook', recipient: 'team', project: '1'},
          },
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {
          name: /OperationalError: could not connect to server/,
        })
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/inbox/notebook/1000210/?recipient=team&subjectType=notebook'
      );
    });

    it('ignores unknown filter values in the url', async () => {
      const unfilteredRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/inbox/',
        match: [
          MockApiClient.matchQuery({
            subject_type: undefined,
            event_type: undefined,
            recipient: undefined,
          }),
        ],
        body: [issueItem],
      });

      render(<Inbox />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/inbox/',
            query: {subjectType: 'bogus', recipient: 'bogus'},
          },
          routes: INBOX_ROUTES,
        },
      });

      expect(
        await screen.findByRole('link', {name: /TypeError: Cannot read properties/})
      ).toBeInTheDocument();
      expect(unfilteredRequest).toHaveBeenCalled();
      expect(
        screen.queryByRole('button', {name: 'Remove Subject filter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Remove Recipient filter'})
      ).not.toBeInTheDocument();
    });
  });

  it('renders not found without the feature flag', () => {
    const inboxRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/inbox/',
      body: [notebookItem],
    });

    render(<Inbox />, {organization: OrganizationFixture()});

    expect(
      screen.queryByText('OperationalError: could not connect to server')
    ).not.toBeInTheDocument();
    expect(inboxRequest).not.toHaveBeenCalled();
  });
});
