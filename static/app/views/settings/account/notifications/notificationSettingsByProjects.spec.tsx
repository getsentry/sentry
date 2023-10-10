import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {Project} from 'sentry/types';
import NotificationSettingsByProjects from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';

const renderComponent = (projects: Project[]) => {
  const {organization} = initializeOrg();

  MockApiClient.addMockResponse({
    url: `/projects/`,
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
      organizations={[organization]}
    />
  );
};

describe('NotificationSettingsByProjects', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should render when there are no projects', function () {
    renderComponent([]);
    expect(screen.getByTestId('empty-message')).toHaveTextContent('No projects found');
    expect(screen.queryByPlaceholderText('Search Projects')).not.toBeInTheDocument();
  });

  it('should show search bar when there are enough projects', function () {
    const organization = Organization();
    const projects = [...Array(3).keys()].map(id =>
      TestStubs.Project({organization, id})
    );

    renderComponent(projects);
    expect(screen.getByPlaceholderText('Search Projects')).toBeInTheDocument();
  });

  it('should default to the subdomain org', async function () {
    const organization = Organization();
    const otherOrganization = Organization({
      id: '2',
      slug: 'other-org',
      name: 'other org',
    });
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: otherOrganization.slug,
    });
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
      query: {
        organizationId: otherOrganization.id,
      },
      method: 'GET',
      body: [],
    });

    render(
      <NotificationSettingsByProjects
        notificationType="alerts"
        notificationSettings={{}}
        onChange={jest.fn()}
        onSubmitSuccess={jest.fn()}
        organizations={[organization, otherOrganization]}
      />
    );
    expect(await screen.findByText(otherOrganization.name)).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });
});
