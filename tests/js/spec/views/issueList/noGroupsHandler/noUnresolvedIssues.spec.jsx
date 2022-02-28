import {enzymeRender} from 'sentry-test/enzyme';

import CongratsRobotsVideo from 'sentry/views/issueList/noGroupsHandler/congratsRobots';
import NoUnresolvedIssues from 'sentry/views/issueList/noGroupsHandler/noUnresolvedIssues';

// Mocking this because of https://github.com/airbnb/enzyme/issues/2326
jest.mock('sentry/views/issueList/noGroupsHandler/congratsRobots', () =>
  jest.fn(() => null)
);

describe('NoUnresolvedIssues', function () {
  it('renders', async function () {
    const wrapper = enzymeRender(<NoUnresolvedIssues />);

    // Need this because of suspense
    await tick();
    await tick();
    wrapper.update();

    expect(wrapper.find('Message').exists()).toBe(true);
    expect(wrapper.find(CongratsRobotsVideo).exists()).toBe(true);
  });
});
