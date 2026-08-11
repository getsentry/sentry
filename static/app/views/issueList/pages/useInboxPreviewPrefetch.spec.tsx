import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useInboxPreviewPrefetch} from 'sentry/views/issueList/pages/useInboxPreviewPrefetch';

const PREFETCH_DELAY_MS = 300;

function IssueCard({groupId}: {groupId: string}) {
  const hoverProps = useInboxPreviewPrefetch(groupId);

  return <div {...hoverProps}>Issue card</div>;
}

describe('useInboxPreviewPrefetch', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture({id: '101'});

  let groupRequest: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    groupRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

  function hover() {
    return user.hover(screen.getByText('Issue card'));
  }

  function unhover() {
    return user.unhover(screen.getByText('Issue card'));
  }

  it('prefetches the issue when hovered for the delay', async () => {
    render(<IssueCard groupId={group.id} />, {organization});

    await hover();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch the issue when unhovered before the delay', async () => {
    render(<IssueCard groupId={group.id} />, {organization});

    await hover();
    await unhover();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).not.toHaveBeenCalled();
  });

  it('does not prefetch the issue when unmounted before the delay', async () => {
    const {unmount} = render(<IssueCard groupId={group.id} />, {organization});

    await hover();
    unmount();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).not.toHaveBeenCalled();
  });
});
