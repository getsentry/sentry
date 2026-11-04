import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/dateTime';

import {DataCategoryExact} from 'sentry/types/core';

import {CustomerStatsFilters} from 'admin/components/customers/customerStatsFilters';

it('preserves on-demand calendar dates when the viewer is west of UTC', () => {
  render(
    <DateTimeProvider value={{timezone: 'America/New_York'}}>
      <CustomerStatsFilters
        dataType={DataCategoryExact.ERROR}
        onChange={() => {}}
        organization={OrganizationFixture()}
        onDemandPeriodStart="2018-09-25"
        onDemandPeriodEnd="2018-10-25"
      />
    </DateTimeProvider>
  );
  expect(screen.getByText(/Sep 25, 2018/)).toBeInTheDocument();
  expect(screen.getByText(/Oct 25, 2018/)).toBeInTheDocument();
  expect(screen.queryByText(/Invalid date/)).not.toBeInTheDocument();
});
