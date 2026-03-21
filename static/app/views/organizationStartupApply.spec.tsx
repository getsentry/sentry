import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStartupApply from 'sentry/views/organizationStartupApply';

describe('OrganizationStartupApply', () => {
  const organization = OrganizationFixture({slug: 'test-org'});

  it('renders the form with all fields', () => {
    render(<OrganizationStartupApply />, {organization});

    expect(screen.getByText('Sentry for Startups')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Startup Name'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Startup Website'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Sentry Org Slug'})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Name(s) of Founder(s)'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Email to contact you'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'When was your company founded?'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Funding Details'})).toBeInTheDocument();
  });

  it('pre-populates org slug from organization', () => {
    render(<OrganizationStartupApply />, {organization});

    const orgSlugInput = screen.getByRole('textbox', {name: 'Sentry Org Slug'});
    expect(orgSlugInput).toHaveValue('test-org');
  });

  it('renders submit button', () => {
    render(<OrganizationStartupApply />, {organization});

    expect(
      screen.getByRole('button', {name: 'Submit Application'})
    ).toBeInTheDocument();
  });

  it('renders eligibility requirements', () => {
    render(<OrganizationStartupApply />, {organization});

    expect(screen.getByText('Eligibility Requirements')).toBeInTheDocument();
    expect(screen.getByText('Founded in the last 2 years')).toBeInTheDocument();
    expect(
      screen.getByText('Raised less than $5M in venture capital')
    ).toBeInTheDocument();
    expect(screen.getByText('New to paying for Sentry')).toBeInTheDocument();
  });
});
