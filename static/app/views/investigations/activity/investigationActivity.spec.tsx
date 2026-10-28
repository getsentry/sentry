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
  const editor = await screen.findByRole('combobox', {name});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
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
