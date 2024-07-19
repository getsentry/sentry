import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import SentryOrganizationRoleSelectorField from './sentryOrganizationRoleSelectorField';

describe('SentryOrganizationRoleSelectorField', () => {
  it('can change role values', async () => {
    const mock = jest.fn();

    render(
      <SentryOrganizationRoleSelectorField onChange={mock} name="Role" label="role" />
    );

    // Simulate selecting a role from the dropdown
    await selectEvent.select(screen.getByText(/choose a role/i), 'Member');

    // Verify the onChange handler was called with the correct arguments
    // Assuming '2' is the id for the 'Member' role based on the ORG_ROLES mock
    expect(mock).toHaveBeenCalledWith('member', expect.anything());
  });
});
