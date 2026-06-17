import {GroupFixture} from 'sentry-fixture/group';

import {
  act,
  renderHookWithProviders,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {useIssuePreviewDrawer} from 'sentry/views/issueList/pages/useIssuePreviewDrawer';

const AWAITING_INPUT_PATH = '/organizations/org-slug/issues/awaiting-input/';

describe('useIssuePreviewDrawer', () => {
  it('sets the preview query param when opening a preview', () => {
    const {result, router} = renderHookWithProviders(() => useIssuePreviewDrawer(), {
      initialRouterConfig: {location: {pathname: AWAITING_INPUT_PATH}},
    });

    expect(result.current.selectedIssueId).toBeUndefined();

    act(() => {
      result.current.openIssuePreview(GroupFixture({id: '42'}));
    });

    expect(router.location.query.preview).toBe('42');
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
