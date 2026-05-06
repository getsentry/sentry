import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SettingsPageTabs} from 'getsentry/views/seerAutomation/components/settingsPageTabs';

describe('SettingsPageTabs', () => {
  it('shows tabs for new Seer cohorts', () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
    });

    render(<SettingsPageTabs />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/seer/`,
        },
      },
    });

    expect(screen.getByRole('link', {name: 'Repositories'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/scm/`
    );
    expect(screen.getByRole('link', {name: 'Autofix'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/projects/`
    );
    expect(screen.getByRole('link', {name: 'Code Review'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/repos/`
    );
  });

  it('shows legacy tab order for code-review-beta cohorts', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
    });

    render(<SettingsPageTabs />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/seer/`,
        },
      },
    });

    expect(screen.getByRole('link', {name: 'Autofix'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/`
    );
    expect(screen.getByRole('link', {name: 'Code Review'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/repos/`
    );
    expect(screen.getByRole('link', {name: 'Repositories'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/scm/`
    );
  });

  it('hides Code Review tab for legacy seer-added-only cohorts', () => {
    const organization = OrganizationFixture({
      features: ['seer-added'],
    });

    render(<SettingsPageTabs />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/seer/`,
        },
      },
    });

    expect(screen.getByRole('link', {name: 'Autofix'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/`
    );
    expect(screen.getByRole('link', {name: 'Repositories'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/scm/`
    );
    expect(screen.queryByRole('link', {name: 'Code Review'})).not.toBeInTheDocument();
  });

  it('shows Code Review tab when legacy seer-added org also has code-review-beta', () => {
    const organization = OrganizationFixture({
      features: ['seer-added', 'code-review-beta'],
    });

    render(<SettingsPageTabs />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/seer/`,
        },
      },
    });

    expect(screen.getByRole('link', {name: 'Code Review'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/repos/`
    );
  });
});
