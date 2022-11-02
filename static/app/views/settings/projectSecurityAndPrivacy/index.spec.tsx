import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectSecurityAndPrivacy from 'sentry/views/settings/projectSecurityAndPrivacy';

describe('projectSecurityAndPrivacy', function () {
  it('renders form fields', function () {
    const {organization} = initializeOrg();
    const project = TestStubs.ProjectDetails();

    render(<ProjectSecurityAndPrivacy project={project} organization={organization} />);

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable server-side data scrubbing',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to apply default scrubbers to prevent things like passwords and credit cards from being stored',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('textbox', {
        name: 'Enter field names which data scrubbers should ignore. Separate multiple entries with a newline',
      })
    ).toHaveValue('business-email\ncompany');

    expect(
      screen.getByRole('textbox', {
        name: 'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline',
      })
    ).toHaveValue('creditcard\nssn');

    expect(
      screen.getByRole('textbox', {
        name: 'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline',
      })
    ).toHaveValue('creditcard\nssn');
  });

  it('disables field when equivalent org setting is true', function () {
    const {organization} = initializeOrg();
    const project = TestStubs.ProjectDetails();

    organization.dataScrubber = true;
    organization.scrubIPAddresses = false;

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    render(<ProjectSecurityAndPrivacy project={project} organization={organization} />);

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).toBeEnabled();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Enable server-side data scrubbing'})
    ).toBeDisabled();

    expect(
      screen.getByRole('checkbox', {name: 'Enable server-side data scrubbing'})
    ).toBeChecked();
  });
});
