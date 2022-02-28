import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import OrganizationDetails from 'sentry/views/organizationDetails';

jest.mock('sentry/components/sidebar', () => () => <div />);

describe('OrganizationDetails', function () {
  let getTeamsMock;
  let getProjectsMock;

  beforeEach(function () {
    OrganizationStore.reset();
    act(() => ProjectsStore.reset());

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: [],
    });
    getTeamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TestStubs.Team()],
    });
    getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project()],
    });
  });

  it('can fetch projects and teams', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: TestStubs.Organization({
        slug: 'org-slug',
      }),
    });

    mountWithTheme(
      <OrganizationDetails
        params={{orgId: 'org-slug'}}
        location={{}}
        routes={[]}
        includeSidebar={false}
      >
        <div />
      </OrganizationDetails>
    );

    expect(getTeamsMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
  });

  describe('deletion states', () => {
    it('should render a restoration prompt', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: TestStubs.Organization({
          slug: 'org-slug',
          status: {
            id: 'pending_deletion',
            name: 'pending deletion',
          },
        }),
      });

      mountWithTheme(
        <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]}>
          <div />
        </OrganizationDetails>
      );

      expect(await screen.findByText('Deletion Scheduled')).toBeInTheDocument();
      expect(screen.getByLabelText('Restore Organization')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Would you like to cancel this process and restore the organization back to the original state?'
        )
      ).toBeInTheDocument();
    });

    it('should render a restoration prompt without action for members', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: TestStubs.Organization({
          slug: 'org-slug',
          access: [],
          status: {
            id: 'pending_deletion',
            name: 'pending deletion',
          },
        }),
      });

      mountWithTheme(
        <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]}>
          <div />
        </OrganizationDetails>
      );

      expect(await screen.findByText('Deletion Scheduled')).toBeInTheDocument();

      const mistakeText = screen.getByText(
        'If this is a mistake, contact an organization owner and ask them to restore this organization.'
      );

      expect(mistakeText).toBeInTheDocument();
      expect(screen.queryByLabelText('Restore Organization')).not.toBeInTheDocument();
    });
  });

  it('should render a deletion in progress prompt', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: TestStubs.Organization({
        slug: 'org-slug',
        status: {
          id: 'deletion_in_progress',
          name: 'deletion in progress',
        },
      }),
    });

    mountWithTheme(
      <OrganizationDetails params={{orgId: 'org-slug'}} location={{}} routes={[]}>
        <div />
      </OrganizationDetails>
    );

    const inProgress = await screen.findByText(
      'currently in the process of being deleted from Sentry.',
      {exact: false}
    );

    expect(inProgress).toBeInTheDocument();
    expect(screen.queryByLabelText('Restore Organization')).not.toBeInTheDocument();
  });
});
