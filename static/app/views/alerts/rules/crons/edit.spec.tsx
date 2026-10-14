import {MemberFixture} from 'sentry-fixture/member';
import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {CronRulesEdit} from 'sentry/views/alerts/rules/crons/edit';

describe('CronRulesEdit', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const monitor = MonitorFixture({project});

  beforeEach(() => {
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [MemberFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [TeamFixture()],
    });
  });

  it('loads the monitor without expanding the alert rule', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/`,
      body: monitor,
    });

    render(
      <CronRulesEdit
        organization={organization}
        project={project}
        onChangeTitle={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/alerts/crons-rules/${project.slug}/${monitor.slug}/`,
          },
          route: '/organizations/:orgId/alerts/crons-rules/:projectId/:monitorSlug/',
        },
      }
    );

    expect(await screen.findByRole('textbox', {name: 'Name'})).toHaveValue(monitor.name);
    expect(request.mock.calls[0]?.[1]?.query).toBeUndefined();
  });
});
