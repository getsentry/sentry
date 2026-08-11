import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

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

  function hover() {
    fireEvent.mouseEnter(screen.getByText('Issue card'));
  }

  function unhover() {
    fireEvent.mouseLeave(screen.getByText('Issue card'));
  }

  it('prefetches the issue when hovered for the delay', () => {
    render(<IssueCard groupId={group.id} />, {organization});

    hover();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch the issue when unhovered before the delay', () => {
    render(<IssueCard groupId={group.id} />, {organization});

    hover();
    unhover();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).not.toHaveBeenCalled();
  });

  it('does not prefetch the issue when unmounted before the delay', () => {
    const {unmount} = render(<IssueCard groupId={group.id} />, {organization});

    hover();
    unmount();
    act(() => {
      jest.advanceTimersByTime(PREFETCH_DELAY_MS);
    });

    expect(groupRequest).not.toHaveBeenCalled();
  });
});
