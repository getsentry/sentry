import {Fragment} from 'react';
import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import GlobalModal from 'sentry/components/globalModal';
import ModalStore from 'sentry/stores/modalStore';
import {DataScrubbing} from 'sentry/views/settings/components/dataScrubbing';

const relayPiiConfig = JSON.stringify(DataScrubbingRelayPiiConfigFixture());

describe('Data Scrubbing', function () {
  beforeEach(() => {
    ModalStore.reset();
  });

  describe('Organization level', function () {
    const {organization} = initializeOrg();
    const additionalContext = 'These rules can be configured for each project.';
    const endpoint = `organization/${organization.slug}/`;

    it('default render', function () {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
        />
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

    it('render empty state', function () {
      render(
        <DataScrubbing
          endpoint={endpoint}
          relayPiiConfig={undefined}
          organization={organization}
          onSubmitSuccess={jest.fn()}
        />
      );

      expect(screen.getByText('You have no data scrubbing rules')).toBeInTheDocument();
    });

    it('render disabled actions', function () {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          disabled
        />
      );

      // Read Docs is the only enabled action
      expect(screen.getByRole('button', {name: 'Read Docs'})).toBeEnabled();

      expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();

      for (const index in JSON.parse(relayPiiConfig).rules as number[]) {
        expect(screen.getAllByRole('button', {name: 'Edit Rule'})[index]).toBeDisabled();
        expect(
          screen.getAllByRole('button', {name: 'Delete Rule'})[index]
        ).toBeDisabled();
      }
    });
  });

  describe('Project level', function () {
    it('default render', function () {
      const {organization, project} = initializeOrg();

      render(
        <DataScrubbing
          endpoint={`/projects/${organization.slug}/foo/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          project={project}
        />
      );

      // Header
      expect(
        screen.getByText('There are no data scrubbing rules at the organization level')
      ).toBeInTheDocument();
    });

    it('OrganizationRules has content', function () {
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
        {organization}
      );

      // Organization Rules
      expect(screen.getByText('Organization Rules')).toBeInTheDocument();
    });

    it('Delete rule successfully', async function () {
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
        </Fragment>
      );

      await userEvent.click(screen.getAllByLabelText('Delete Rule')[0]!);

      expect(
        await screen.findByText('Are you sure you wish to delete this rule?')
      ).toBeInTheDocument();
    });

    it('Open Add Rule Modal', async function () {
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
        </Fragment>
      );

      await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));

      expect(
        await screen.findByText('Add an advanced data scrubbing rule')
      ).toBeInTheDocument();
    });

    it('Open Edit Rule Modal', async function () {
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
        {router}
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
});
