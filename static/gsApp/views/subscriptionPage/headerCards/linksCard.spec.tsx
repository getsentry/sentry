import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import LinksCard from 'getsentry/views/subscriptionPage/headerCards/linksCard';

describe('LinksCard', () => {
  it('renders for user with billing perms and org with spend visibility notifications', () => {
    const organization = OrganizationFixture({
      features: ['spend-visibility-notifications'],
      access: ['org:billing'],
    });
    render(<LinksCard organization={organization} />);
    expect(screen.getByText('Receipts & notifications')).toBeInTheDocument();
    expect(screen.queryByText('Activity log')).not.toBeInTheDocument();
    expect(screen.getByText('View all receipts')).toBeInTheDocument();
    expect(screen.getByText('View activity')).toBeInTheDocument();
    expect(screen.getByText('Manage spend notifications')).toBeInTheDocument();
  });

  it('renders for user with billing perms and org without spend visibility notifications', () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    render(<LinksCard organization={organization} />);
    expect(screen.getByText('Receipts & notifications')).toBeInTheDocument();
    expect(screen.queryByText('Activity log')).not.toBeInTheDocument();
    expect(screen.getByText('View all receipts')).toBeInTheDocument();
    expect(screen.getByText('View activity')).toBeInTheDocument();
    expect(screen.queryByText('Manage spend notifications')).not.toBeInTheDocument();
  });

  it('renders for user without billing perms', () => {
    const organization = OrganizationFixture({
      features: ['spend-visibility-notifications'],
      access: ['org:read'],
    });
    render(<LinksCard organization={organization} />);
    expect(screen.getByText('Activity log')).toBeInTheDocument();
    expect(screen.queryByText('Receipts & notifications')).not.toBeInTheDocument();
    expect(screen.getByText('View activity')).toBeInTheDocument();
    expect(screen.queryByText('View all receipts')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage spend notifications')).not.toBeInTheDocument();
  });
});
