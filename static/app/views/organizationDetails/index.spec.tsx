import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {pinFilter} from 'sentry/actionCreators/pageFilters';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import OrganizationDetails from 'sentry/views/organizationDetails';

jest.mock(
  'sentry/components/sidebar',
  () =>
    function () {
      return <div />;
    }
);

describe('OrganizationDetails', function () {
  const {routerProps} = initializeOrg();

  let getTeamsMock;
  let getProjectsMock;

  beforeEach(function () {
    OrganizationStore.reset();
    ProjectsStore.reset();
    PageFiltersStore.reset();

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
      body: [Team()],
    });
    getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
    });
  });

  it('can fetch projects and teams', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: Organization({
        slug: 'org-slug',
      }),
    });

    render(
      <OrganizationDetails
        {...routerProps}
        params={{orgId: 'org-slug'}}
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
        body: Organization({
          slug: 'org-slug',
          status: {
            id: 'pending_deletion',
            name: 'pending deletion',
          },
        }),
      });

      render(
        <OrganizationDetails {...routerProps} params={{orgId: 'org-slug'}}>
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
        body: Organization({
          slug: 'org-slug',
          access: [],
          status: {
            id: 'pending_deletion',
            name: 'pending deletion',
          },
        }),
      });

      render(
        <OrganizationDetails {...routerProps} params={{orgId: 'org-slug'}}>
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
      body: Organization({
        slug: 'org-slug',
        status: {
          id: 'deletion_in_progress',
          name: 'deletion in progress',
        },
      }),
    });

    render(
      <OrganizationDetails {...routerProps} params={{orgId: 'org-slug'}}>
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

  it('should switch organization', async function () {
    const body = Organization({slug: 'org-slug'});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/', body});
    MockApiClient.addMockResponse({url: '/organizations/other-org/', body});
    MockApiClient.addMockResponse({url: '/organizations/other-org/teams/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/other-org/projects/', body: []});

    const {rerender} = render(
      <OrganizationDetails {...routerProps}>
        <div />
      </OrganizationDetails>
    );

    pinFilter('projects', true);
    await waitFor(() =>
      expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set(['projects']))
    );

    rerender(
      <OrganizationDetails {...routerProps} params={{orgId: 'org-slug'}}>
        <div />
      </OrganizationDetails>
    );

    expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set(['projects']));

    rerender(
      <OrganizationDetails {...routerProps} params={{orgId: 'other-org'}}>
        <div />
      </OrganizationDetails>
    );

    await waitFor(() =>
      expect(PageFiltersStore.getState().pinnedFilters).toEqual(new Set())
    );
  });
});
