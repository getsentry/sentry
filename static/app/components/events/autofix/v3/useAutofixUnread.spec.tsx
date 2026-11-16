import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixUnread} from './useAutofixUnread';

describe('useAutofixUnread', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  function mockRun(status: string) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: {
        autofix: {run_id: 1, status, updated_at: '2026-11-16T10:00:00Z', blocks: []},
      },
    });
  }

  function renderUnread() {
    return renderHookWithProviders(
      ({isViewing}: {isViewing: boolean}) =>
        useAutofixUnread(group, {enabled: true, isViewing}),
      {organization, initialProps: {isViewing: false}}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();
  });

  it('is unread once a run stops and clears after viewing the tab', async () => {
    mockRun('completed');

    const {result, rerender} = renderUnread();
    await waitFor(() => expect(result.current).toBe(true));

    rerender({isViewing: true});
    rerender({isViewing: false});
    expect(result.current).toBe(false);
  });

  it('stays read while a run is still working', async () => {
    const request = mockRun('processing');

    const {result} = renderUnread();
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
