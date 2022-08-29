import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import GlobalModal from 'sentry/components/globalModal';
import DataScrubbing from 'sentry/views/settings/components/dataScrubbing';

const relayPiiConfig = JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig());

describe('Data Scrubbing', function () {
  describe('Organization level', function () {
    const organization = TestStubs.Organization();
    const additionalContext = 'These rules can be configured for each project.';

    it('default render', function () {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={`organization/${organization.slug}/`}
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
            `${additionalContext} The new rules will only apply to upcoming events.  For more details, see full documentation on data scrubbing.`
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

    it('render disabled actions', function () {
      render(
        <DataScrubbing
          additionalContext={additionalContext}
          endpoint={`organization/${organization.slug}/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          disabled
        />
      );

      // Read Docs is the only enabled action
      expect(screen.getByRole('button', {name: 'Read Docs'})).toBeEnabled();

      expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();

      for (const index in JSON.parse(relayPiiConfig).rules) {
        expect(screen.getAllByRole('button', {name: 'Edit Rule'})[index]).toBeDisabled();
        expect(
          screen.getAllByRole('button', {name: 'Delete Rule'})[index]
        ).toBeDisabled();
      }
    });
  });

  describe('Project level', function () {
    it('default render', function () {
      const organization = TestStubs.Organization();

      render(
        <DataScrubbing
          endpoint={`/projects/${organization.slug}/foo/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          projectId="foo"
        />
      );

      // Header
      expect(
        screen.getByText('There are no data scrubbing rules at the organization level')
      ).toBeInTheDocument();
    });

    it('OrganizationRules has content', function () {
      const organization = TestStubs.Organization({relayPiiConfig});

      render(
        <DataScrubbing
          endpoint={`/projects/${organization.slug}/foo/`}
          relayPiiConfig={relayPiiConfig}
          organization={organization}
          onSubmitSuccess={jest.fn()}
          projectId="foo"
        />
      );

      // Organization Rules
      expect(screen.getByText('Organization Rules')).toBeInTheDocument();
    });

    it('Delete rule successfully', async function () {
      const organization = TestStubs.Organization();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            projectId="foo"
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>
      );

      userEvent.click(screen.getAllByLabelText('Delete Rule')[0]);

      expect(
        await screen.findByText('Are you sure you wish to delete this rule?')
      ).toBeInTheDocument();
    });

    it('Open Add Rule Modal', async function () {
      const organization = TestStubs.Organization();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            projectId="foo"
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>
      );

      userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));

      expect(
        await screen.findByText('Add an advanced data scrubbing rule')
      ).toBeInTheDocument();
    });

    it('Open Edit Rule Modal', async function () {
      const organization = TestStubs.Organization();

      render(
        <Fragment>
          <GlobalModal />
          <DataScrubbing
            endpoint={`/projects/${organization.slug}/foo/`}
            projectId="foo"
            relayPiiConfig={relayPiiConfig}
            disabled={false}
            organization={organization}
            onSubmitSuccess={jest.fn()}
          />
        </Fragment>
      );

      userEvent.click(screen.getAllByRole('button', {name: 'Edit Rule'})[0]);

      expect(
        await screen.findByText('Edit an advanced data scrubbing rule')
      ).toBeInTheDocument();
    });
  });
});
