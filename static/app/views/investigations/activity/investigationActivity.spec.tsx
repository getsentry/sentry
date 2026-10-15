import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
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
    pathname: '/organizations/org-slug/explore/investigations/investigation-1/',
  },
  route: '/organizations/:orgId/explore/investigations/:investigationId/',
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
    expect(within(items[0]!).getByText('on Latency query')).toBeInTheDocument();
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

  it('hides the composer on an archived investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
    renderPage();

    await findActivity();
    expect(
      screen.queryByRole('combobox', {name: 'Add a comment'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Comment'})).not.toBeInTheDocument();
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
