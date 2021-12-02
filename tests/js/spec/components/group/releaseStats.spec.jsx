import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import ConfigStore from 'sentry/stores/configStore';

jest.mock('sentry/actionCreators/modal', () => ({
  openAddDashboardWidgetModal: jest.fn(),
}));

describe('GroupReleaseStats', function () {
  const {organization, project, routerContext} = initializeOrg();

  beforeAll(function () {
    // Set timezone for snapshot
    ConfigStore.loadInitialData({
      user: {
        options: {
          timezone: 'America/Los_Angeles',
        },
      },
    });
  });

  const createWrapper = props =>
    mountWithTheme(
      <GroupReleaseStats
        group={TestStubs.Group()}
        project={project}
        organization={organization}
        allEnvironments={TestStubs.Group()}
        environments={[]}
        {...props}
      />,
      routerContext
    );

  it('renders all environments', function () {
    const wrapper = createWrapper();
    expect(wrapper.find('[data-test-id="env-label"]').text()).toBe('All Environments');
    expect(wrapper.find('GroupReleaseChart')).toHaveLength(2);
    expect(wrapper.find('SeenInfo')).toHaveLength(2);
  });

  it('renders specific environments', function () {
    const wrapper = createWrapper({environments: TestStubs.Environments()});
    expect(wrapper.find('[data-test-id="env-label"]').text()).toBe(
      'Production, Staging, STAGING'
    );
    expect(wrapper.find('GroupReleaseChart')).toHaveLength(2);
    expect(wrapper.find('SeenInfo')).toHaveLength(2);
  });
  it('opens dashboard widget', function () {
    const wrapper = createWrapper({
      organization: {
        ...organization,
        features: ['create-dashboard-widget-from-issue', 'dashboards-edit'],
      },
    });
    expect(wrapper.find('AddToDashboard')).toHaveLength(2);
    wrapper.find('AddToDashboard').first().simulate('click');
    expect(openAddDashboardWidgetModal).toHaveBeenCalled();
  });
  it('need create-dashboard-widget-from-issue to render add to dashboards', function () {
    const wrapper = createWrapper({
      organization: {
        ...organization,
        features: ['dashboards-edit'],
      },
    });
    expect(wrapper.find('AddToDashboard')).toHaveLength(0);
  });
  it('need dashboards-edit to render add to dashboards', function () {
    const wrapper = createWrapper({
      organization: {
        ...organization,
        features: ['create-dashboard-widget-from-issue'],
      },
    });
    expect(wrapper.find('AddToDashboard')).toHaveLength(0);
  });
});
