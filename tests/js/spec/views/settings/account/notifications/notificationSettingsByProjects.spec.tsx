import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'app/types';
import NotificationSettingsByProjects from 'app/views/settings/account/notifications/notificationSettingsByProjects';

const createWrapper = (projects: Project[]) => {
  const {routerContext} = initializeOrg();

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/projects/',
    method: 'GET',
    body: projects,
  });

  const notificationSettings = {
    alerts: {
      user: {me: {email: 'always', slack: 'always'}},
      project: Object.fromEntries(
        projects.map(project => [project.id, {email: 'never', slack: 'never'}])
      ),
    },
  };

  return mountWithTheme(
    <NotificationSettingsByProjects
      notificationType="alerts"
      notificationSettings={notificationSettings}
      onChange={jest.fn()}
    />,
    routerContext
  );
};

describe('NotificationSettingsByProjects', function () {
  it('should render when there are no projects', function () {
    const wrapper = createWrapper([]);
    expect(wrapper.find('EmptyMessage').text()).toEqual('No projects found');
    expect(wrapper.find('AsyncComponentSearchInput')).toHaveLength(0);
    expect(wrapper.find('Pagination')).toHaveLength(0);
  });

  // Warning: Cannot update during an existing state transition (such as within
  // `render`). Render methods should be a pure function of props and state.
  it.skip('should show search bar when there are enough projects', function () {
    // @ts-expect-error
    const projects = Array.from(Array(3)).map(_ => TestStubs.Project());
    const wrapper = createWrapper(
      {
        alerts: {
          user: {me: {email: 'always', slack: 'always'}},
          project: Object.fromEntries(
            projects.map(project => [project.id, {email: 'never', slack: 'never'}])
          ),
        },
      },
      projects
    );
    expect(wrapper.find('AsyncComponentSearchInput')).toHaveLength(1);
  });
});
