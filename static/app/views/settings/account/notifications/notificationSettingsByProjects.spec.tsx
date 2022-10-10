import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Project} from 'sentry/types';
import NotificationSettingsByProjects from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';

const renderComponent = (projects: Project[]) => {
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

  render(
    <NotificationSettingsByProjects
      notificationType="alerts"
      notificationSettings={notificationSettings}
      onChange={jest.fn()}
      onSubmitSuccess={jest.fn()}
    />,
    {context: routerContext}
  );
};

describe('NotificationSettingsByProjects', function () {
  it('should render when there are no projects', function () {
    renderComponent([]);
    expect(screen.getByTestId('empty-message')).toHaveTextContent('No projects found');
    expect(screen.queryByPlaceholderText('Search Projects')).not.toBeInTheDocument();
  });

  it('should show search bar when there are enough projects', function () {
    const organization = TestStubs.Organization();
    const projects = [...Array(3).keys()].map(id =>
      TestStubs.Project({organization, id})
    );

    renderComponent(projects);
    expect(screen.getByPlaceholderText('Search Projects')).toBeInTheDocument();
  });
});
