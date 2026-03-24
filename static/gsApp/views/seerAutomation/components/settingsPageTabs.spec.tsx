import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SettingsPageTabs} from 'getsentry/views/seerAutomation/components/settingsPageTabs';

describe('SettingsPageTabs', () => {
  it('shows overview tab for new Seer cohorts', () => {
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

    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Autofix'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/projects/`
    );
  });

  it('shows legacy tab order for legacy and beta cohorts', () => {
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

    expect(screen.queryByRole('tab', {name: 'Overview'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Autofix'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/`
    );
    expect(screen.getByRole('link', {name: 'Code Review'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/repos/`
    );
    expect(screen.getByRole('link', {name: 'Source Code Management'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/scm/`
    );
  });
});
