import {render} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import ReplaysFilters from 'sentry/views/replays/filters';

describe('ReplayFilters', function () {
  it('renders', function () {
    const organization = TestStubs.Organization();
    const wrapper = render(
      <OrganizationContext.Provider value={TestStubs.Organization()}>
        <ReplaysFilters
          organization={organization}
          handleSearchQuery={jest.fn()}
          query=""
        />
      </OrganizationContext.Provider>
    );
    expect(wrapper.container).toSnapshot();
  });
});
