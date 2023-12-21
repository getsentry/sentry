import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';

jest.mock('sentry/utils/replayCount/useReplayCountForIssues');

function mockCount(count: undefined | number) {
  const getReplayCountForIssue = jest.fn().mockReturnValue(count);
  jest.mocked(useReplayCountForIssues).mockReturnValue({
    getReplayCountForIssue,
    getReplayCountForIssues: jest.fn(),
    issueHasReplay: jest.fn(),
    issuesHaveReplay: jest.fn(),
  });
  return getReplayCountForIssue;
}

describe('IssueReplayCount', function () {
  const groupId = '3363325111';
  const {organization, routerContext} = initializeOrg();

  it('does not render when a group has undefined count', async function () {
    const mockGetReplayCountForIssue = mockCount(undefined);

    const {container} = render(<IssueReplayCount groupId={groupId} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });

    expect(mockGetReplayCountForIssue).toHaveBeenCalledWith(groupId);
  });

  it('does not render when a group has a count of zero', async function () {
    const mockGetReplayCountForIssue = mockCount(0);

    const {container} = render(<IssueReplayCount groupId={groupId} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });

    expect(mockGetReplayCountForIssue).toHaveBeenCalledWith(groupId);
  });

  it('renders the correct replay count', async function () {
    const mockGetReplayCountForIssue = mockCount(2);

    const {container} = render(<IssueReplayCount groupId={groupId} />, {
      context: routerContext,
    });

    await waitFor(() => {
      expect(container).not.toBeEmptyDOMElement();
    });

    const replayCount = screen.getByLabelText('replay-count');
    expect(replayCount).toHaveTextContent('2');
    expect(replayCount).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${groupId}/replays/`
    );
    expect(mockGetReplayCountForIssue).toHaveBeenCalledWith(groupId);
  });
});
