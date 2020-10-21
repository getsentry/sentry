import {mountWithTheme} from 'sentry-test/enzyme';

import NoUnresolvedIssues from 'app/views/issueList/noGroupsHandler/noUnresolvedIssues';
import CongratsRobotsVideo from 'app/views/issueList/noGroupsHandler/congratsRobots';

// Mocking this because of https://github.com/airbnb/enzyme/issues/2326
jest.mock('app/views/issueList/noGroupsHandler/congratsRobots', () =>
  jest.fn(() => null)
);

describe('NoUnresolvedIssues', function () {
  it('renders', async function () {
    const wrapper = mountWithTheme(<NoUnresolvedIssues />);

    // Need this because of suspense
    await tick();
    await tick();
    wrapper.update();

    expect(wrapper.find('Message').exists()).toBe(true);
    expect(wrapper.find(CongratsRobotsVideo).exists()).toBe(true);
  });
});
