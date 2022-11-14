import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import {useReplaysCountContext} from 'sentry/components/replays/replayCountContext';

jest.mock('sentry/components/replays/replayCountContext');

const MockUseReplaysCountContext = useReplaysCountContext as jest.MockedFunction<
  typeof useReplaysCountContext
>;

describe('IssueReplayCount', function () {
  const groupId = '3363325111';
  const organization = TestStubs.Organization();

  it('does not render when a group has no replays', async function () {
    MockUseReplaysCountContext.mockReturnValue({});

    const {container} = render(<IssueReplayCount groupId={groupId} />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the correct replay count', async function () {
    MockUseReplaysCountContext.mockReturnValue({
      [groupId]: 2,
    });

    const {container} = render(<IssueReplayCount groupId={groupId} />);

    await waitFor(() => {
      expect(container).not.toBeEmptyDOMElement();
      const replayCount = screen.getByLabelText('replay-count');
      expect(replayCount).toHaveTextContent('2');
      expect(replayCount).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/issues/${groupId}/replays/`
      );
    });
  });
});
