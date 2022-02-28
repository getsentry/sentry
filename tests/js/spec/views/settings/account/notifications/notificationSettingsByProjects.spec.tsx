import {enzymeRender} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'sentry/types';
import NotificationSettingsByProjects from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';

const createWrapper = (projects: Project[]) => {
  const {routerContext} = initializeOrg();

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

  return enzymeRender(
    <NotificationSettingsByProjects
      notificationType="alerts"
      notificationSettings={notificationSettings}
      onChange={jest.fn()}
      onSubmitSuccess={jest.fn()}
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

  it('should show search bar when there are enough projects', function () {
    const organization = TestStubs.Organization();
    const projects = [...Array(3).keys()].map(id =>
      TestStubs.Project({organization, id})
    );

    const wrapper = createWrapper(projects);
    expect(wrapper.find('AsyncComponentSearchInput')).toHaveLength(1);
  });
});
