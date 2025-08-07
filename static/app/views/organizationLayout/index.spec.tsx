import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertStore from 'sentry/stores/alertStore';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import OrganizationLayout from 'sentry/views/organizationLayout';

jest.mock(
  'sentry/components/sidebar',
  () =>
    function () {
      return <div />;
    }
);

describe('OrganizationLayout', function () {
  beforeEach(function () {
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
  });

  describe('deletion states', () => {
    it('should render a restoration prompt', async function () {
      const organization = OrganizationFixture({
        status: {
          id: 'pending_deletion',
          name: 'pending deletion',
        },
      });
      OrganizationStore.onUpdate(organization);

      render(
        <OrganizationLayout>
          <div />
        </OrganizationLayout>,
        {
          organization,
        }
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
      const organization = OrganizationFixture({
        access: [],
        status: {
          id: 'pending_deletion',
          name: 'pending deletion',
        },
      });
      OrganizationStore.onUpdate(organization);

      render(
        <OrganizationLayout>
          <div />
        </OrganizationLayout>,
        {
          organization,
        }
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
    const organization = OrganizationFixture({
      status: {
        id: 'deletion_in_progress',
        name: 'deletion in progress',
      },
    });
    OrganizationStore.onUpdate(organization);

    render(
      <OrganizationLayout>
        <div />
      </OrganizationLayout>,
      {
        organization,
      }
    );

    const inProgress = await screen.findByText(
      'currently in the process of being deleted from Sentry.',
      {exact: false}
    );

    expect(inProgress).toBeInTheDocument();
    expect(screen.queryByLabelText('Restore Organization')).not.toBeInTheDocument();
  });

  it('displays system alerts', async function () {
    OrganizationStore.onUpdate(OrganizationFixture());

    AlertStore.addAlert({
      id: 'abc123',
      message: 'Celery workers have not checked in',
      type: 'error',
      url: '/internal/health/',
    });

    render(
      <OrganizationLayout>
        <div />
      </OrganizationLayout>
    );

    expect(
      await screen.findByText(/Celery workers have not checked in/)
    ).toBeInTheDocument();
  });

  describe('new navigation layout', () => {
    beforeEach(() => {
      ConfigStore.set('user', {
        ...ConfigStore.get('user'),
        options: {
          ...ConfigStore.get('user').options,
          prefersStackedNavigation: true,
        },
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/starred/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/assistant/',
        body: [],
      });
    });

    it('can render navigation without an organization', async function () {
      OrganizationStore.setNoOrganization();

      render(
        <OrganizationContext.Provider value={null}>
          <OrganizationLayout>
            <div />
          </OrganizationLayout>
        </OrganizationContext.Provider>
      );

      await screen.findByTestId('no-organization-sidebar');
    });
  });
});
