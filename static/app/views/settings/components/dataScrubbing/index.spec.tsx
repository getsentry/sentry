import {Fragment} from 'react';
import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import GlobalModal from 'sentry/components/globalModal';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';

const relayPiiConfig = JSON.stringify(DataScrubbingRelayPiiConfigFixture());

describe('Data Scrubbing', () => {
  describe('Organization level', () => {
    const {organization} = initializeOrg();
    const additionalContext = 'These rules can be configured for each project.';
    const endpoint = `organization/${organization.slug}/`;

    it('default render', () => {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
        />,
        {
          deprecatedRouterMocks: true,
        }
      );

      // Header
      expect(screen.getByText('Advanced Data Scrubbing')).toBeInTheDocument();

      // Alert
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            `${additionalContext} The new rules will only apply to upcoming events. For more details, see full documentation on data scrubbing.`
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {name: 'full documentation on data scrubbing'})
      ).toHaveAttribute(
        'href',
        `https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/`
      );

      // Body
      expect(screen.getAllByRole('button', {name: 'Edit Rule'})).toHaveLength(3);

      // Actions
      expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
        'href',
        `https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/`
      );
      expect(screen.getByRole('button', {name: 'Add Rule'})).toBeEnabled();
    });

    it('render empty state', () => {
      render(
        <DataScrubbing
          endpoint={endpoint}
          relayPiiConfig={undefined}
          organization={organization}
          onSubmitSuccess={jest.fn()}
        />,
        {
          deprecatedRouterMocks: true,
        }
      );

      expect(screen.getByText('You have no data scrubbing rules')).toBeInTheDocument();
    });

    it('render disabled actions', () => {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          disabled
        />,
        {
          deprecatedRouterMocks: true,
        }
      );

      // Read Docs is the only enabled action
      expect(screen.getByRole('button', {name: 'Read Docs'})).toBeEnabled();

      expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();

      Object.keys(DataScrubbingRelayPiiConfigFixture).forEach(index => {
        expect(
          screen.getAllByRole('button', {name: 'Edit Rule'})[Number(index)]
        ).toBeDisabled();
        expect(
          screen.getAllByRole('button', {name: 'Delete Rule'})[Number(index)]
        ).toBeDisabled();
      });
    });
  });

  describe('Project level', () => {
    it('default render', () => {
      const {organization, project} = initializeOrg();

      render(
        <DataScrubbing
          endpoint={`/projects/${organization.slug}/foo/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          project={project}
        />,
        {
          deprecatedRouterMocks: true,
        }
      );

      // Header
      expect(
        screen.getByText('There are no data scrubbing rules at the organization level')
      ).toBeInTheDocument();
    });

    it('OrganizationRules has content', () => {
      const {organization, project} = initializeOrg({
        organization: {
          relayPiiConfig,
        },
      });

      render(
        <DataScrubbing
          endpoint={`/projects/${organization.slug}/foo/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          project={project}
        />,
        {
          organization,
          deprecatedRouterMocks: true,
        }
      );

      // Organization Rules
      expect(screen.getByText('Organization Rules')).toBeInTheDocument();
    });

    it('Delete rule successfully', async () => {
      const {organization, project} = initializeOrg();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            project={project}
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>,
        {
          deprecatedRouterMocks: true,
        }
      );

      await userEvent.click(screen.getAllByLabelText('Delete Rule')[0]!);

      expect(
        await screen.findByText('Are you sure you wish to delete this rule?')
      ).toBeInTheDocument();
    });

    it('Open Add Rule Modal', async () => {
      const {organization, project} = initializeOrg();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            project={project}
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>,
        {
          deprecatedRouterMocks: true,
        }
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));

      expect(
        await screen.findByText('Add an advanced data scrubbing rule')
      ).toBeInTheDocument();
    });

    it('Open Edit Rule Modal', async () => {
      const {organization, router, project} = initializeOrg();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            project={project}
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      await userEvent.click(screen.getAllByRole('button', {name: 'Edit Rule'})[0]!);

      // Verify the router to open the modal was called
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: `/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/advanced-data-scrubbing/0/`,
        })
      );
    });
  });

  describe('with ourlogs-enabled', () => {
    const organization = OrganizationFixture({
      features: ['ourlogs-enabled', 'ourlogs-visualize-sidebar'],
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace-items/attributes/`,
        method: 'GET',
        body: [
          {key: 'user.email', name: 'user.email', kind: 'tag'},
          {key: 'user.id', name: 'user.id', kind: 'tag'},
          {key: 'custom.field', name: 'custom.field', kind: 'tag'},
          {key: 'request.method', name: 'request.method', kind: 'tag'},
          {key: 'response.status', name: 'response.status', kind: 'tag'},
        ],
      });
    });

    it('passes attributeResults to modals when ourlogs-enabled', async () => {
      const {project} = initializeOrg({organization});

      render(
        <OrganizationContext.Provider value={organization}>
          <Fragment>
            <GlobalModal />
            <DataScrubbing
              endpoint={`/projects/${organization.slug}/foo/`}
              project={project}
              relayPiiConfig={relayPiiConfig}
              disabled={false}
              organization={organization}
              onSubmitSuccess={jest.fn()}
            />
          </Fragment>
        </OrganizationContext.Provider>,
        {
          deprecatedRouterMocks: true,
        }
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));

      expect(
        await screen.findByText('Add an advanced data scrubbing rule')
      ).toBeInTheDocument();

      expect(screen.getByText('Dataset')).toBeInTheDocument();
    });
  });
});
