import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectSecurityAndPrivacy from 'sentry/views/settings/projectSecurityAndPrivacy';

describe('projectSecurityAndPrivacy', () => {
  it('renders form fields', () => {
    const organization = OrganizationFixture({features: ['event-attachments']});
    const project = ProjectFixture({
      sensitiveFields: ['creditcard', 'ssn'],
      safeFields: ['business-email', 'company'],
    });

    render(<ProjectSecurityAndPrivacy />, {
      organization,
      outletContext: {project},
    });

    expect(
      screen.getByRole('checkbox', {
        name: 'Data Scrubber',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Use Default Scrubbers',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Prevent Storing of IP Addresses',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('textbox', {
        name: 'Safe Fields',
      })
    ).toHaveValue('business-email\ncompany');

    expect(
      screen.getByRole('textbox', {
        name: 'Additional Sensitive Fields',
      })
    ).toHaveValue('creditcard\nssn');
  });

  it('disables field when equivalent org setting is true', () => {
    const {organization} = initializeOrg();
    const project = ProjectFixture();

    organization.dataScrubber = true;
    organization.scrubIPAddresses = false;

    render(<ProjectSecurityAndPrivacy />, {
      organization,
      outletContext: {project},
    });

    expect(
      screen.getByRole('checkbox', {
        name: 'Prevent Storing of IP Addresses',
      })
    ).toBeEnabled();

    expect(
      screen.getByRole('checkbox', {
        name: 'Prevent Storing of IP Addresses',
      })
    ).not.toBeChecked();

    expect(screen.getByRole('checkbox', {name: 'Data Scrubber'})).toBeDisabled();

    expect(screen.getByRole('checkbox', {name: 'Data Scrubber'})).toBeChecked();
  });

  it('disables fields when missing project:write access', () => {
    const {organization} = initializeOrg({
      organization: {
        access: [], // Remove all access
      },
    });
    const project = ProjectFixture();

    render(<ProjectSecurityAndPrivacy />, {
      organization,
      outletContext: {project},
    });

    // Check that the data scrubber toggle is disabled
    expect(
      screen.getByRole('checkbox', {
        name: 'Data Scrubber',
      })
    ).toBeDisabled();
  });
});
