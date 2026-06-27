import {GroupFixture} from 'sentry-fixture/group';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';
import {useIssuePreviewDrawer} from 'sentry/views/issueList/pages/useIssuePreviewDrawer';

const AWAITING_INPUT_PATH = '/organizations/org-slug/issues/awaiting-input/';

describe('useIssuePreviewDrawer', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/42/',
      body: GroupFixture({id: '42'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/42/attachments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/42/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/42/autofix/setup/',
      body: {
        integration: {ok: false, reason: null},
        billing: {hasAutofixQuota: false},
        seerReposLinked: false,
      },
    });
  });

  it('sets the preview query param when opening a preview', async () => {
    const {result, router} = renderHookWithProviders(() => useIssuePreviewDrawer(), {
      initialRouterConfig: {location: {pathname: AWAITING_INPUT_PATH}},
    });

    expect(result.current.selectedIssueId).toBeNull();

    act(() => {
      result.current.openIssuePreview(GroupFixture({id: '42'}));
    });

    await waitFor(() => {
      expect(router.location.query.preview).toBe('42');
    });
  });

  it('opens the drawer when the preview param is present', async () => {
    renderHookWithProviders(() => useIssuePreviewDrawer(), {
      initialRouterConfig: {
        location: {pathname: AWAITING_INPUT_PATH, query: {preview: '42'}},
      },
    });

    expect(
      await screen.findByRole('complementary', {name: 'Issue preview'})
    ).toBeInTheDocument();
  });

  it('displays the issue activity', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/42/',
      body: GroupFixture({
        id: '42',
        activity: [
          {
            id: '1',
            type: GroupActivityType.NOTE,
            data: {text: 'This is a comment'},
            dateCreated: '2024-01-01T00:00:00Z',
            user: UserFixture(),
          },
          {
            id: '2',
            type: GroupActivityType.FIRST_SEEN,
            data: {},
            dateCreated: '2024-01-01T00:00:00Z',
            user: null,
          },
        ],
      }),
    });

    renderHookWithProviders(() => useIssuePreviewDrawer(), {
      initialRouterConfig: {
        location: {pathname: AWAITING_INPUT_PATH, query: {preview: '42'}},
      },
    });

    expect(await screen.findByText('This is a comment')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
  });

  it('removes the preview param when the drawer is closed', async () => {
    const {router} = renderHookWithProviders(() => useIssuePreviewDrawer(), {
      initialRouterConfig: {
        location: {pathname: AWAITING_INPUT_PATH, query: {preview: '42'}},
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));

    expect(router.location.query.preview).toBeUndefined();
  });
});
