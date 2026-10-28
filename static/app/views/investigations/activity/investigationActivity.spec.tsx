import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import InvestigationDetailView from 'sentry/views/investigations/detail';
import {
  InvestigationCommentFixture,
  InvestigationDetailFixture,
  InvestigationActionRequestFixture,
} from 'sentry/views/investigations/fixtures';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';
const commentsUrl = `${detailUrl}comments/`;
const initialRouterConfig = {
  location: {
    pathname: '/organizations/org-slug/seer/investigations/investigation-1/',
  },
  route: '/organizations/:orgId/seer/investigations/:investigationId/',
};

function renderPage() {
  return render(<InvestigationDetailView />, {organization, initialRouterConfig});
}

function findActivity() {
  return screen.findByRole('list', {name: 'Activity'});
}

async function findEditor(name: string) {
  return await screen.findByRole('combobox', {name});
}

describe('InvestigationActivity', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
  });

  it('lists comments newest first, then the creation', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [
        InvestigationCommentFixture({
          id: '2',
          body: 'Second',
          blockId: 'block-2',
          author: null,
        }),
        InvestigationCommentFixture({id: '1', body: 'First'}),
      ],
    });
    renderPage();

    const activity = await findActivity();
    const items = within(activity).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Second');
    expect(within(items[0]!).getByText('Unknown user commented')).toBeInTheDocument();
    expect(
      within(items[0]!).getByRole('link', {name: 'Latency query'})
    ).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('First');
    expect(within(items[1]!).getByText('Ada Lovelace commented')).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('Investigation first created');
  });

  it('merges applied action requests into the comments by date', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedBy: {
              id: '2',
              name: 'Grace Hopper',
              email: 'grace@example.com',
              username: 'grace@example.com',
              ip_address: '',
            },
            dateApplied: '2026-01-02T00:00:00Z',
            appliedDetails: {
              detectorId: '789',
              detectorName: 'Checkout errors',
              fields: ['timeWindowSeconds'],
            },
          }),
          InvestigationActionRequestFixture({
            id: '313',
            key: 'raise-threshold',
            title: 'Raise the threshold',
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}action-requests/313/apply/`,
      method: 'POST',
      body: {
        actionRequest: InvestigationActionRequestFixture({
          id: '313',
          key: 'raise-threshold',
          title: 'Raise the threshold',
        }),
      },
    });
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [
        InvestigationCommentFixture({
          id: '2',
          body: 'After the change',
          dateCreated: '2026-01-03T00:00:00Z',
        }),
        InvestigationCommentFixture({
          id: '1',
          body: 'Before the change',
          dateCreated: '2026-01-01T00:00:00Z',
        }),
      ],
    });
    renderPage();

    const activity = await findActivity();
    const items = within(activity).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('After the change');
    expect(items[1]).toHaveTextContent(
      'Grace Hopper updated the interval for Checkout errors'
    );
    expect(
      within(items[1]!).getByRole('link', {name: 'Checkout errors'})
    ).toHaveAttribute('href', '/organizations/org-slug/monitors/789/');
    expect(items[2]).toHaveTextContent('Before the change');
    expect(items[3]).toHaveTextContent('Investigation first created');
    expect(within(activity).queryByText(/Raise the threshold/)).not.toBeInTheDocument();
  });

  it('records a connected provider', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-02T00:00:00Z',
            appliedDetails: {provider: 'datadog'},
            action: {kind: 'connect_telemetry', provider: 'datadog'},
            followUp: {
              status: 'acknowledged',
              reason: null,
              rerun: 'started',
              retryable: false,
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    const items = within(await findActivity()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Datadog connected');
    expect(items[0]).not.toHaveTextContent('re-run');
  });

  it('names who connected a provider and why Seer did not re-run', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-02T00:00:00Z',
            appliedBy: {
              id: '2',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              username: 'ada@example.com',
              ip_address: '',
            },
            appliedDetails: {provider: 'datadog'},
            action: {kind: 'connect_telemetry', provider: 'datadog'},
            followUp: {
              status: 'failed',
              reason: 'provider_already_used',
              rerun: null,
              retryable: false,
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    const items = within(await findActivity()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ada Lovelace connected Datadog');
    expect(items[0]).toHaveTextContent(
      "Seer already used Datadog in this investigation, so it didn't re-run it."
    );
  });

  it('names every changed setting once', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-02T00:00:00Z',
            appliedBy: {
              id: '2',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              username: 'ada@example.com',
              ip_address: '',
            },
            appliedDetails: {
              detectorId: '789',
              detectorName: 'Checkout errors',
              fields: ['timeWindowSeconds', 'highThreshold', 'resolutionThreshold'],
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    const items = within(await findActivity()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(
      'Ada Lovelace updated the interval and threshold for Checkout errors'
    );
  });

  it('describes an automatic monitor update', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-02T00:00:00Z',
            appliedDetails: {
              detectorId: '789',
              detectorName: 'Checkout errors',
              fields: ['query'],
            },
          }),
          InvestigationActionRequestFixture({
            id: '313',
            key: 'second',
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-01T00:00:00Z',
            appliedDetails: {
              detectorId: '790',
              detectorName: 'Cart latency',
              fields: ['query', 'environment'],
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    const items = within(await findActivity()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('The query for Checkout errors changed');
    expect(items[1]).toHaveTextContent(
      'The query and environment for Cart latency changed'
    );
  });

  it('names the monitor when a changed setting is new to the UI', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            dateApplied: '2026-01-02T00:00:00Z',
            appliedDetails: {
              detectorId: '789',
              detectorName: 'Checkout errors',
              fields: ['query', 'newSetting'],
            },
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    const items = within(await findActivity()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('The query for Checkout errors changed');
  });

  it('leaves out applied action requests older than the loaded comments', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            title: 'Older change',
            dateApplied: '2026-01-01T00:00:00Z',
          }),
          InvestigationActionRequestFixture({
            id: '313',
            key: 'newer-change',
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            title: 'Newer change',
            dateApplied: '2026-01-03T00:00:00Z',
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({dateCreated: '2026-01-02T00:00:00Z'})],
      headers: {
        Link: `<${commentsUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    renderPage();

    const activity = await findActivity();
    expect(within(activity).getByText('“Newer change” was applied')).toBeInTheDocument();
    expect(within(activity).queryByText(/Older change/)).not.toBeInTheDocument();
  });

  it('notes when older comments are not shown', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture()],
      headers: {
        Link: `<${commentsUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    renderPage();

    expect(
      within(await findActivity()).getByText('Showing the latest 100 comments.')
    ).toBeInTheDocument();
  });

  it('posts a comment with Enter', async () => {
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    const request = MockApiClient.addMockResponse({
      url: commentsUrl,
      method: 'POST',
      body: InvestigationCommentFixture({body: 'Looks like the deploy'}),
    });
    renderPage();

    const input = await findEditor('Add a comment');
    await userEvent.type(input, '  Looks like the deploy  {Enter}');

    expect(request).toHaveBeenCalledWith(
      commentsUrl,
      expect.objectContaining({data: {body: 'Looks like the deploy'}})
    );
    await waitFor(() => expect(input).toHaveTextContent(/^$/));
  });

  it('hides the composer and comment actions on an archived investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture()],
    });
    renderPage();

    const activity = await findActivity();
    expect(
      screen.queryByRole('combobox', {name: 'Add a comment'})
    ).not.toBeInTheDocument();
    expect(
      within(activity).queryByRole('button', {name: 'Comment actions'})
    ).not.toBeInTheDocument();
  });

  it('keeps the comment count on an archived investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture()],
    });
    renderPage();

    expect(await screen.findByRole('button', {name: '1 comment'})).toBeEnabled();
  });

  it('hides the comment count on an archived investigation without comments', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    await findActivity();
    expect(screen.queryByRole('button', {name: 'Comment'})).not.toBeInTheDocument();
  });

  it('edits your own comment', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({body: 'Rolling back'})],
    });
    const request = MockApiClient.addMockResponse({
      url: `${commentsUrl}1/`,
      method: 'PUT',
      body: InvestigationCommentFixture({body: 'Rolling back now'}),
    });
    renderPage();

    const activity = await findActivity();
    await userEvent.click(
      within(activity).getByRole('button', {name: 'Comment actions'})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Edit'}));
    await userEvent.type(await findEditor('Edit comment'), ' now');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(request).toHaveBeenCalledWith(
      `${commentsUrl}1/`,
      expect.objectContaining({data: {body: 'Rolling back now'}})
    );
    expect(await screen.findByRole('button', {name: 'Comment actions'})).toHaveFocus();
  });

  it('shows the saved edit when the list refetch fails', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({body: 'Rolling back'})],
    });
    MockApiClient.addMockResponse({
      url: `${commentsUrl}1/`,
      method: 'PUT',
      body: InvestigationCommentFixture({body: 'Rolling back now'}),
    });
    renderPage();

    const activity = await findActivity();
    expect(await within(activity).findByText('Rolling back')).toBeInTheDocument();
    MockApiClient.addMockResponse({url: commentsUrl, statusCode: 500, body: {}});
    await userEvent.click(
      within(activity).getByRole('button', {name: 'Comment actions'})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Edit'}));
    await userEvent.type(await findEditor('Edit comment'), ' now');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByRole('button', {name: 'Comment actions'})).toHaveFocus();
    expect(within(activity).getByText('Rolling back now')).toBeInTheDocument();
  });

  it('deletes your own comment after confirming', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture()],
    });
    const request = MockApiClient.addMockResponse({
      url: `${commentsUrl}1/`,
      method: 'DELETE',
    });
    renderPage();
    renderGlobalModal();

    const activity = await findActivity();
    await userEvent.click(
      within(activity).getByRole('button', {name: 'Comment actions'})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Delete'})
    );

    expect(request).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('combobox', {name: 'Add a comment'})).toHaveFocus()
    );
  });

  it('marks a comment edited right after posting', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [
        InvestigationCommentFixture({
          dateCreated: '2026-08-13T20:00:00Z',
          dateUpdated: '2026-08-13T20:00:00.500Z',
        }),
      ],
    });
    renderPage();

    const activity = await findActivity();
    expect(await within(activity).findByText('(edited)')).toBeInTheDocument();
  });

  it('removes a deleted comment when the list refetch fails', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({body: 'Rolling back'})],
    });
    const request = MockApiClient.addMockResponse({
      url: `${commentsUrl}1/`,
      method: 'DELETE',
    });
    renderPage();
    renderGlobalModal();

    const activity = await findActivity();
    expect(await within(activity).findByText('Rolling back')).toBeInTheDocument();
    MockApiClient.addMockResponse({url: commentsUrl, statusCode: 500, body: {}});
    await userEvent.click(
      within(activity).getByRole('button', {name: 'Comment actions'})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Delete'})
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(activity).queryByText('Rolling back')).not.toBeInTheDocument()
    );
  });

  it('has no actions on comments by others', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [
        InvestigationCommentFixture({
          author: {
            id: '2',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            username: 'grace@example.com',
            ip_address: '127.0.0.1',
          },
        }),
      ],
    });
    renderPage();

    const activity = await findActivity();
    expect(within(activity).getByText('Grace Hopper commented')).toBeInTheDocument();
    expect(
      within(activity).queryByRole('button', {name: 'Comment actions'})
    ).not.toBeInTheDocument();
  });

  it('jumps to the composer from the comment count', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({id: '2'}), InvestigationCommentFixture()],
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', {name: '2 comments'}));
    expect(screen.getByRole('combobox', {name: 'Add a comment'})).toHaveFocus();
  });
});
