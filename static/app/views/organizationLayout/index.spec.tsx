import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as bootstrapRequestOptions from 'sentry/bootstrap/bootstrapRequestOptions';
import AlertStore from 'sentry/stores/alertStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {queryOptions} from 'sentry/utils/queryClient';
import App from 'sentry/views/app';

import OrganizationLayout from './index';

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

  describe('organizaztion details request errors', () => {
    const organization = OrganizationFixture();
    function SimpleChild() {
      return <div>hello world</div>;
    }

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [organization],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: organization,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/teams/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/assistant/',
        body: [],
      });
    });

    it('handles 429 errors', async () => {
      const orgQueryOptions =
        bootstrapRequestOptions.getBootstrapOrganizationQueryOptions(organization.slug);

      const {router, routerProps} = initializeOrg({
        organization,
        router: {
          params: {orgId: organization.slug},
        },
      });

      const {rerender} = render(
        <App {...routerProps}>
          <OrganizationLayout>
            <SimpleChild />
          </OrganizationLayout>
        </App>,
        {router, deprecatedRouterMocks: true}
      );
      await waitFor(() => {
        expect(
          screen.queryByText('Loading data for your organization')
        ).not.toBeInTheDocument();
      });
      expect(screen.getByText('hello world')).toBeInTheDocument();

      // mock console.error to prevent it from failing jest tests since we're expecting the request error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      jest
        .spyOn(bootstrapRequestOptions, 'getBootstrapOrganizationQueryOptions')
        .mockImplementation(() => {
          return queryOptions({
            ...orgQueryOptions,
            // change queryKey to force a new query
            queryKey: ['bootstrap-organization-429', organization.slug],
          });
        });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: null,
        statusCode: 429,
      });

      // Simulate a second API call (e.g., user focuses page after being idle, react-query queries re-fire due to expiration
      rerender(
        <App {...routerProps}>
          <OrganizationLayout>
            <SimpleChild />
          </OrganizationLayout>
        </App>
      );

      await waitFor(() => {
        expect(screen.getByText('hello world')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
