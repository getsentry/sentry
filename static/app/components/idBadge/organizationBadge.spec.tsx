import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';

describe('OrganizationBadge', () => {
  it('renders with Avatar and organization name', () => {
    render(<OrganizationBadge organization={OrganizationFixture()} />);
    expect(screen.getByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent(
      'Organization Name'
    );
  });
});
