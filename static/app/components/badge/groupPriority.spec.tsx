import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GroupPriorityDropdown} from 'sentry/components/badge/groupPriority';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';

describe('GroupPriority', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
  });

  describe('GroupPriorityDropdown', () => {
    const defaultProps = {
      groupId: '1',
      onChange: jest.fn(),
      value: PriorityLevel.HIGH,
    };

    it('skips request when sent lastEditedBy', async () => {
      render(<GroupPriorityDropdown {...defaultProps} lastEditedBy="system" />);

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

      expect(
        screen.getByText(textWithMarkupMatcher('Last edited by Sentry'))
      ).toBeInTheDocument();
    });

    it('fetches the last priority edit when not passed in', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/1/activities/',
        body: {
          activity: [
            ActivityFeedFixture({
              type: GroupActivityType.SET_PRIORITY,
              user: UserFixture({name: 'John Doe'}),
            }),
            ActivityFeedFixture({
              type: GroupActivityType.SET_PRIORITY,
              user: UserFixture({name: 'Other User'}),
            }),
          ],
        },
      });

      render(<GroupPriorityDropdown {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

      expect(
        await screen.findByText(textWithMarkupMatcher('Last edited by John Doe'))
      ).toBeInTheDocument();
    });

    it('shows a learn more banner that may be dismissed', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/1/activities/',
        body: {activity: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {data: {}},
      });
      const dismissMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        method: 'PUT',
      });

      render(<GroupPriorityDropdown {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

      expect(screen.getByText('Time to prioritize')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Learn more'})).toHaveAttribute(
        'href',
        'https://docs.sentry.io/product/issues/issue-priority/'
      );

      // Can dimiss the banner
      await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
      expect(dismissMock).toHaveBeenCalledWith(
        '/organizations/org-slug/prompts-activity/',
        expect.objectContaining({
          data: expect.objectContaining({
            feature: 'issue_priority',
            status: 'dismissed',
          }),
        })
      );
      expect(screen.queryByText('Organize, prioritize!')).not.toBeInTheDocument();
    });
  });
});
