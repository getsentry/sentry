import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

describe('OrganizationAuditLog', () => {
  const user = {
    ...TestStubs.User(),
    options: {
      clock24Hours: true,
      timezone: 'America/Los_Angeles',
    },
  };

  beforeEach(() => {
    ConfigStore.loadInitialData({user});
  });

  it('renders', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: [
        {
          id: '4500000',
          actor: TestStubs.User(),
          event: 'project.remove',
          ipAddress: '127.0.0.1',
          note: 'removed project test',
          targetObject: 5466660,
          targetUser: null,
          data: {},
          dateCreated: '2021-09-28T00:29:33.940848Z',
        },
        {
          id: '430000',
          actor: TestStubs.User(),
          event: 'org.create',
          ipAddress: '127.0.0.1',
          note: 'created the organization',
          targetObject: 54215,
          targetUser: null,
          data: {},
          dateCreated: '2016-11-21T04:02:45.929313Z',
        },
      ],
    });

    const {router, routerContext, organization} = initializeOrg({
      projects: [],
      router: {
        location: {query: {}},
        params: {orgId: 'org-slug'},
      },
    });
    render(
      <OrganizationAuditLog
        organization={organization}
        params={{orgId: organization.slug}}
        location={router.location}
      />,
      {
        context: routerContext,
      }
    );

    expect(screen.getByText('project.remove')).toBeInTheDocument();
    expect(screen.getByText('org.create')).toBeInTheDocument();
    expect(screen.getAllByText('127.0.0.1')).toHaveLength(2);
    expect(screen.getByText('17:29 PDT')).toBeInTheDocument();
  });
});
