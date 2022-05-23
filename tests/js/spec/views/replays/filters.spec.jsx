import {render} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import ReplaysFilters from 'sentry/views/replays/filters';

describe('ReplayFilters', function () {
  let wrapper;
  it('renders', function () {
    wrapper = render(
      <OrganizationContext.Provider value={TestStubs.Organization()}>
        <ReplaysFilters
          organization={{
            features: ['performance-view', 'discover-query'],
            apdexThreshold: 400,
          }}
          handleSearchQuery={jest.fn()}
          query=""
        />
      </OrganizationContext.Provider>
    );
    expect(wrapper).toSnapshot();
  });
});
