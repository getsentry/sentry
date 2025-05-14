import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import HookStore from 'sentry/stores/hookStore';

import hookSidebarDropdownMenu from 'getsentry/hooks/sidebarDropdownMenu';

describe('sidebar:organization-dropdown-menu', function () {
  beforeEach(function () {
    HookStore.init();
  });

  it('renders "Support" link', async function () {
    HookStore.add('sidebar:organization-dropdown-menu', hookSidebarDropdownMenu);

    render(<SidebarDropdown orientation="top" collapsed={false} />);

    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Support'})).toHaveAttribute(
      'href',
      'https://sentry.zendesk.com/hc/en-us'
    );
  });

  it('renders "Usage & Billing" link only for `org:billing` access', async function () {
    HookStore.add('sidebar:organization-dropdown-menu', hookSidebarDropdownMenu);

    const billingOrg = OrganizationFixture({access: ['org:billing']});

    render(<SidebarDropdown orientation="top" collapsed={false} />, {
      organization: billingOrg,
    });

    await userEvent.click(screen.getByTestId('sidebar-dropdown'));
    expect(screen.getByRole('link', {name: 'Usage & Billing'})).toHaveAttribute(
      'href',
      '/settings/org-slug/billing/'
    );
  });
});
