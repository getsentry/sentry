import {Fragment} from 'react';
import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {createMockTraceItemAttributesResponse} from 'sentry-fixture/traceItemAttributeKeys';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GlobalModal} from '@sentry/scraps/modal';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';
import {MethodType, RuleType} from 'sentry/views/settings/components/dataScrubbing/types';

const relayPiiConfig = JSON.stringify(DataScrubbingRelayPiiConfigFixture());
const relayPiiConfigWithConstructorSource = JSON.stringify({
  rules: {
    0: {
      type: RuleType.PASSWORD,
      redaction: {method: MethodType.REPLACE, text: 'Scrubbed'},
    },
    1: {type: RuleType.EMAIL, redaction: {method: MethodType.MASK}},
  },
  applications: {password: ['0'], constructor: ['1']},
});
const passwordRuleDescription =
  '[Replace] [Password fields] with [Scrubbed] from [password]';

describe('Data Scrubbing', () => {
  describe('Organization level', () => {
    const organization = OrganizationFixture();
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
          organization,
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
        'https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/'
      );

      // Body
      expect(screen.getAllByRole('button', {name: 'Edit Rule'})).toHaveLength(3);

      // Actions
      expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
        'href',
        'https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/'
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
          organization,
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
          organization,
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
      const organization = OrganizationFixture();
      const project = ProjectFixture();

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
        }
      );

      // Header
      expect(
        screen.getByText('There are no data scrubbing rules at the organization level')
      ).toBeInTheDocument();
    });

    it('OrganizationRules has content', async () => {
      const organization = OrganizationFixture({
        relayPiiConfig,
      });
      const project = ProjectFixture();

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
        }
      );

      // Organization Rules
      expect(await screen.findByText('Organization Rules')).toBeInTheDocument();
    });

    it('Delete rule successfully', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture();

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
          organization,
        }
      );

      await userEvent.click(screen.getAllByLabelText('Delete Rule')[0]!);

      expect(
        await screen.findByText('Are you sure you wish to delete this rule?')
      ).toBeInTheDocument();
    });

    it('submits rules with sources that match Object prototype properties', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture();
      const endpoint = `/projects/${organization.slug}/foo/`;
      const updateMock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: {relayPiiConfig: JSON.stringify({rules: {}, applications: {}})},
      });

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={endpoint}
            project={project}
            relayPiiConfig={relayPiiConfigWithConstructorSource}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>,
        {
          organization,
        }
      );

      const deleteButtons = await screen.findAllByLabelText('Delete Rule');
      await userEvent.click(deleteButtons[0]!);
      fireEvent.change(await screen.findByPlaceholderText(passwordRuleDescription), {
        target: {value: passwordRuleDescription},
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

      await waitFor(() => expect(updateMock).toHaveBeenCalled());

      const requestPayload = updateMock.mock.calls[0]![1].data;
      const submittedRelayPiiConfig = JSON.parse(requestPayload.relayPiiConfig);

      expect(submittedRelayPiiConfig).toEqual({
        rules: {
          0: {type: RuleType.EMAIL, redaction: {method: MethodType.MASK}},
        },
        applications: {constructor: ['0']},
      });
    });

    it('Open Add Rule Modal', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture();

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
          organization,
        }
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));

      expect(
        await screen.findByText('Add an advanced data scrubbing rule')
      ).toBeInTheDocument();
    });

    it('Open Edit Rule Modal', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture();

      const {router} = render(
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
          organization,
          initialRouterConfig: {
            location: {
              pathname: `/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/`,
            },
            route: '/settings/:orgId/projects/:projectId/security-and-privacy/',
          },
        }
      );

      await userEvent.click(screen.getAllByRole('button', {name: 'Edit Rule'})[0]!);

      // Verify the router to open the modal was called
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/advanced-data-scrubbing/0/`
        );
      });
    });
  });

  describe('with ourlogs-enabled', () => {
    const organization = OrganizationFixture({
      features: ['ourlogs-enabled'],
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace-items/attributes/`,
        method: 'GET',
        body: createMockTraceItemAttributesResponse(),
      });
    });

    it('passes attributeResults to modals when ourlogs-enabled', async () => {
      const project = ProjectFixture();

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
          organization,
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
