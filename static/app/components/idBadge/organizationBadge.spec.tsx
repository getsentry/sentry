import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';

describe('OrganizationBadge', function () {
  it('renders with Avatar and organization name', function () {
    render(<OrganizationBadge organization={OrganizationFixture()} />);
    expect(screen.getByTestId('default-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('org-slug');
  });
});
