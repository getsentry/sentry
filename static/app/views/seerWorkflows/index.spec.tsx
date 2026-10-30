import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import AutomationsLayout from 'sentry/views/seerWorkflows';

describe('AutomationsLayout', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});

  function renderLayout(pathname: string) {
    render(<AutomationsLayout />, {
      organization,
      initialRouterConfig: {location: {pathname}},
    });
  }

  it('renders the Automations title with an alpha badge', () => {
    renderLayout('/organizations/org-slug/seer/automations/');

    expect(screen.getByRole('heading', {name: 'Automations'})).toBeInTheDocument();
    expect(screen.getByLabelText('alpha')).toBeInTheDocument();
  });

  it('links the Automations and Runs tabs', () => {
    renderLayout('/organizations/org-slug/seer/automations/');

    expect(
      within(screen.getByRole('tab', {name: 'Automations'})).getByRole('link')
    ).toHaveAttribute('href', '/organizations/org-slug/seer/automations/');
    expect(
      within(screen.getByRole('tab', {name: 'Runs'})).getByRole('link')
    ).toHaveAttribute('href', '/organizations/org-slug/seer/automations/runs/');
  });

  it.each([
    ['/organizations/org-slug/seer/automations/', 'Automations'],
    ['/organizations/org-slug/seer/automations/runs/', 'Runs'],
  ])('selects the matching tab on %s', (pathname, tabName) => {
    renderLayout(pathname);

    expect(screen.getByRole('tab', {name: tabName})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
