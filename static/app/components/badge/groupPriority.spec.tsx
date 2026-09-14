import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GroupPriorityDropdown} from 'sentry/components/badge/groupPriority';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';

describe('GroupPriority', () => {
  describe('GroupPriorityDropdown', () => {
    const defaultProps = {
      groupId: '1',
      onChange: jest.fn(),
      value: PriorityLevel.HIGH,
    };

    it('skips request when sent lastEditedBy', async () => {
      render(<GroupPriorityDropdown {...defaultProps} lastEditedBy="system" />, {
        organization: OrganizationFixture({
          features: ['issue-priority-assignee-ui'],
        }),
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Modify issue priority: High'})
      );

      expect(
        screen.getByText(textWithMarkupMatcher('Last edited by Sentry'))
      ).toBeInTheDocument();
    });

    it('fetches the last priority edit when not passed in', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/activities/',
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
  });
});
