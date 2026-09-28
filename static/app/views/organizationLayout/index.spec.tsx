import {Fragment, useEffect} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {type GlobalAlert, useGlobalAlerts} from 'sentry/views/app/globalAlerts';
import {OrganizationLayout} from 'sentry/views/organizationLayout';

function AlertSeeder({alert}: {alert: GlobalAlert}) {
  const {addAlert} = useGlobalAlerts();
  useEffect(() => addAlert(alert), [addAlert, alert]);
  return null;
}

describe('OrganizationLayout', () => {
  beforeEach(() => {
    OrganizationStore.reset();
    ProjectsStore.reset();
    PageFiltersStore.reset();
    ConfigStore.set('user', UserFixture());

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  describe('deletion states', () => {
    it('should render a restoration prompt', async () => {
      const organization = OrganizationFixture({
        status: {
          id: 'pending_deletion',
          name: 'pending deletion',
        },
      });
      OrganizationStore.onUpdate(organization);

      const restoreRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: organization,
      });

      render(<OrganizationLayout />, {
        organization,
      });

      expect(await screen.findByText('Deletion Scheduled')).toBeInTheDocument();

      const restoreButton = screen.getByLabelText('Restore Organization');
      expect(restoreButton).toBeInTheDocument();

      await userEvent.click(restoreButton);
      expect(restoreRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({data: {cancelDeletion: true}})
      );
    });

    it('should render a restoration prompt without action for members', async () => {
      const organization = OrganizationFixture({
        access: [],
        status: {
          id: 'pending_deletion',
          name: 'pending deletion',
        },
      });
      OrganizationStore.onUpdate(organization);

      render(<OrganizationLayout />, {
        organization,
      });

      expect(await screen.findByText('Deletion Scheduled')).toBeInTheDocument();

      const mistakeText = screen.getByText(
        'If this is a mistake, contact an organization owner and ask them to restore this organization.',
        {exact: false}
      );

      expect(mistakeText).toBeInTheDocument();
      expect(screen.queryByLabelText('Restore Organization')).not.toBeInTheDocument();
    });
  });

  it('should render a deletion in progress prompt', async () => {
    const organization = OrganizationFixture({
      status: {
        id: 'deletion_in_progress',
        name: 'deletion in progress',
      },
    });
    OrganizationStore.onUpdate(organization);

    render(<OrganizationLayout />, {
      organization,
    });

    const inProgress = await screen.findByText(
      'currently in the process of being deleted from Sentry.',
      {exact: false}
    );

    expect(inProgress).toBeInTheDocument();
    expect(screen.queryByLabelText('Restore Organization')).not.toBeInTheDocument();
  });

  it('displays system alerts', async () => {
    OrganizationStore.onUpdate(OrganizationFixture());

    render(
      <Fragment>
        <AlertSeeder
          alert={{
            id: 'abc123',
            message: 'Celery workers have not checked in',
            variant: 'danger',
            url: '/internal/health/',
          }}
        />
        <OrganizationLayout />
      </Fragment>
    );

    expect(
      await screen.findByText(/Celery workers have not checked in/)
    ).toBeInTheDocument();
  });

  it('closes the releases drawer and preserves unrelated query parameters', async () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/test-release/meta/`,
      body: ReleaseMetaFixture({projects: []}),
    });

    const {router} = render(<OrganizationLayout />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/1/`,
          query: {
            project: '1',
            query: 'is:unresolved',
            rd: 'show',
            rdFilesCursor: 'cursor',
            rdRelease: 'test-release',
            rdReleaseProjectId: '1',
            rdSource: 'release-version-link',
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));

    await waitFor(() => {
      expect(router.location.query).toEqual({
        project: '1',
        query: 'is:unresolved',
      });
    });
    expect(
      screen.queryByRole('complementary', {name: 'Releases drawer'})
    ).not.toBeInTheDocument();
  });

  describe('new navigation layout', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/starred/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/assistant/',
        body: [],
      });
    });

    it('can render navigation without an organization', async () => {
      OrganizationStore.setNoOrganization();

      render(
        <OrganizationContext.Provider value={null}>
          <OrganizationLayout />
        </OrganizationContext.Provider>
      );

      await screen.findByTestId('no-organization-sidebar');
    });
  });
});
