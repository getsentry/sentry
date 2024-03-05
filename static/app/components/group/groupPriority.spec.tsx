import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GroupPriorityDropdown} from 'sentry/components/group/groupPriority';
import {GroupActivityType, PriorityLevel} from 'sentry/types';

describe('GroupPriority', function () {
  describe('GroupPriorityDropdown', function () {
    const defaultProps = {
      groupId: '1',
      onChange: jest.fn(),
      value: PriorityLevel.HIGH,
    };

    it('skips request when sent lastEditedBy', async function () {
      render(<GroupPriorityDropdown {...defaultProps} lastEditedBy="system" />);

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

      expect(
        screen.getByText(textWithMarkupMatcher('Last edited by Sentry'))
      ).toBeInTheDocument();
    });

    it('fetches the last priority edit when not passed in', async function () {
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
  });
});
