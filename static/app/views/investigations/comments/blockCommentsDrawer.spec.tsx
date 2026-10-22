import {Fragment, useEffect} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {useDrawer} from '@sentry/scraps/drawer';

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

const otherDrawer = {open: () => {}, close: () => {}};
function OtherDrawer() {
  const {openDrawer, closeDrawer} = useDrawer();
  useEffect(() => {
    otherDrawer.open = () => openDrawer(() => <p>Other drawer</p>, {ariaLabel: 'Other'});
    otherDrawer.close = closeDrawer;
  }, [openDrawer, closeDrawer]);
  return null;
}

function renderPage(query: Record<string, string> = {}, extra?: React.ReactNode) {
  return render(
    <Fragment>
      <InvestigationDetailView />
      {extra}
    </Fragment>,
    {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/seer/investigations/investigation-1/',
          query,
        },
        route: '/organizations/:orgId/seer/investigations/:investigationId/',
      },
    }
  );
}

function mockBlockComments(body: unknown[]) {
  return MockApiClient.addMockResponse({
    url: commentsUrl,
    body,
    match: [MockApiClient.matchQuery({blockId: 'block-1'})],
  });
}

describe('BlockCommentsDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
    MockApiClient.addMockResponse({url: commentsUrl, body: []});
  });

  it("opens from a block's menu and lists its comments oldest first", async () => {
    const request = mockBlockComments([
      InvestigationCommentFixture({id: '2', body: 'Second', blockId: 'block-1'}),
      InvestigationCommentFixture({id: '1', body: 'First', blockId: 'block-1'}),
    ]);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Block actions for Summary'})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Comment'}));

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    expect(
      await within(drawer).findByRole('heading', {name: 'Comments on Summary'})
    ).toBeInTheDocument();
    const items = within(
      await within(drawer).findByRole('list', {name: 'Block comments'})
    ).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('First');
    expect(items[1]).toHaveTextContent('Second');
    expect(request).toHaveBeenCalled();
  });

  it('shows an empty block', async () => {
    mockBlockComments([]);
    renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    expect(
      await within(drawer).findByText('No comments on this block yet.')
    ).toBeInTheDocument();
  });

  it('replies on the block', async () => {
    mockBlockComments([]);
    const request = MockApiClient.addMockResponse({
      url: commentsUrl,
      method: 'POST',
      body: InvestigationCommentFixture({blockId: 'block-1'}),
    });
    renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    const editor = await within(drawer).findByRole('combobox', {name: 'Add a comment'});
    expect(within(drawer).getByRole('button', {name: 'Comment'})).toBeDisabled();
    // user-event does not yet recognize contenteditable="plaintext-only".
    editor.setAttribute('contenteditable', 'true');
    await userEvent.type(editor, 'Check this{Enter}');

    expect(request).toHaveBeenCalledWith(
      commentsUrl,
      expect.objectContaining({data: {body: 'Check this', blockId: 'block-1'}})
    );
  });

  it('keeps an unsent reply for the block', async () => {
    mockBlockComments([]);
    const {unmount} = renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    const editor = await within(drawer).findByRole('combobox', {name: 'Add a comment'});
    // user-event does not yet recognize contenteditable="plaintext-only".
    editor.setAttribute('contenteditable', 'true');
    await userEvent.type(editor, 'Half a thought');
    unmount();

    renderPage({comments: 'open', commentsBlock: 'block-1'});
    const reopened = await screen.findByRole('complementary', {name: 'Block comments'});
    expect(
      await within(reopened).findByRole('combobox', {name: 'Add a comment'})
    ).toHaveTextContent('Half a thought');
  });

  it('highlights the comment in the URL', async () => {
    mockBlockComments([
      InvestigationCommentFixture({id: '7', body: 'On it', blockId: 'block-1'}),
    ]);
    renderPage({comments: 'open', commentsBlock: 'block-1', comment: '7'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    const item = await within(drawer).findByRole('listitem');
    expect(item).toHaveAttribute('aria-current', 'true');
  });

  it('closes on a click outside', async () => {
    mockBlockComments([]);
    renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    await userEvent.click(screen.getByRole('heading', {name: 'Activity'}));

    await waitFor(() => expect(drawer).not.toBeInTheDocument());
  });

  it("opens from a block's button", async () => {
    mockBlockComments([]);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Comment on Summary'})
    );

    expect(
      await screen.findByRole('complementary', {name: 'Block comments'})
    ).toBeInTheDocument();
  });

  it('opens at the comment linked from the activity feed', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({id: '7', body: 'On it', blockId: 'block-1'})],
    });
    mockBlockComments([
      InvestigationCommentFixture({id: '7', body: 'On it', blockId: 'block-1'}),
    ]);
    renderPage();

    await userEvent.click(await screen.findByRole('link', {name: 'Summary'}));

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    const item = await within(drawer).findByRole('listitem');
    expect(item).toHaveAttribute('aria-current', 'true');
  });

  it("switches to another block's thread without closing", async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture({id: '7', blockId: 'block-2'})],
    });
    mockBlockComments([]);
    renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    await userEvent.click(await screen.findByRole('link', {name: 'Latency query'}));

    expect(
      await within(drawer).findByRole('heading', {name: 'Comments on Latency query'})
    ).toBeInTheDocument();
  });

  it('keeps the comment button visible with the count on blocks with comments', async () => {
    MockApiClient.addMockResponse({
      url: `${detailUrl}comment-counts/`,
      body: {'block-1': 3},
    });
    renderPage();

    const button = await screen.findByRole('button', {name: '3 comments on Summary'});
    expect(button.closest('[data-pinned]')).toBeInTheDocument();
  });

  it('hides the comment button until hover on blocks without comments', async () => {
    renderPage();

    const button = await screen.findByRole('button', {name: 'Comment on Summary'});
    expect(button.closest('[data-pinned]')).not.toBeInTheDocument();
  });

  it('hides the comment button on archived blocks without comments', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    const counts = MockApiClient.addMockResponse({
      url: `${detailUrl}comment-counts/`,
      body: {},
    });
    renderPage();

    await screen.findByRole('button', {name: 'Block actions for Summary'});
    await waitFor(() => expect(counts).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', {name: 'Comment on Summary'})
    ).not.toBeInTheDocument();
  });

  it('shows the comment button on archived blocks until counts load', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}comment-counts/`,
      statusCode: 500,
      body: {},
    });
    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Comment on Summary'})
    ).toBeInTheDocument();
  });

  it('shows the comment button on archived blocks with comments', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}comment-counts/`,
      body: {'block-1': 2},
    });
    renderPage();

    expect(
      await screen.findByRole('button', {name: '2 comments on Summary'})
    ).toBeInTheDocument();
  });

  it('hides the composer and comment actions on an archived investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({status: 'archived'}),
    });
    mockBlockComments([InvestigationCommentFixture({blockId: 'block-1'})]);
    renderPage({comments: 'open', commentsBlock: 'block-1'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    expect(await within(drawer).findByRole('listitem')).toBeInTheDocument();
    expect(
      within(drawer).queryByRole('combobox', {name: 'Add a comment'})
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', {name: 'Comment actions'})
    ).not.toBeInTheDocument();
  });

  it('says when the block no longer exists', async () => {
    mockBlockComments([]);
    renderPage({comments: 'open', commentsBlock: 'missing-block'});

    const drawer = await screen.findByRole('complementary', {name: 'Block comments'});
    expect(
      await within(drawer).findByText('This block no longer exists.')
    ).toBeInTheDocument();
    expect(
      within(drawer).queryByRole('combobox', {name: 'Add a comment'})
    ).not.toBeInTheDocument();
  });

  it('closes when another drawer replaces it', async () => {
    mockBlockComments([]);
    const {router} = renderPage(
      {comments: 'open', commentsBlock: 'block-1'},
      <OtherDrawer />
    );

    await screen.findByRole('complementary', {name: 'Block comments'});
    act(() => otherDrawer.open());

    expect(await screen.findByText('Other drawer')).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', {name: 'Block comments'})
    ).not.toBeInTheDocument();

    act(() => otherDrawer.close());
    await waitFor(() => expect(router.location.query.comments).toBeUndefined());
    expect(
      screen.queryByRole('complementary', {name: 'Block comments'})
    ).not.toBeInTheDocument();
  });
});
