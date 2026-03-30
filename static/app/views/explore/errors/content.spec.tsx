import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ErrorsContent from './content';

describe('ErrorsContent', () => {
  it('renders the Errors page title', () => {
    const organization = OrganizationFixture();
    render(<ErrorsContent />, {organization});
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });
});
