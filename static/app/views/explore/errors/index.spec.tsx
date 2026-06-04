import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ErrorsPage from './index';

describe('ErrorsPage', () => {
  it('renders the outlet when the feature is enabled', () => {
    const organization = OrganizationFixture({features: ['explore-errors']});
    render(<ErrorsPage />, {organization});
    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });

  it('renders NoAccess when the feature is disabled', () => {
    const organization = OrganizationFixture({features: []});
    render(<ErrorsPage />, {organization});
    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });
});
