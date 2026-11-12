import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

it('starts absolute billing periods at local midnight', async () => {
  moment.tz.setDefault('America/New_York');
  try {
    render(
      <CustomerStatsFilters
        dataType={DataCategoryExact.ERROR}
        onChange={() => {}}
        organization={OrganizationFixture()}
        onDemandPeriodStart="2018-09-25"
        onDemandPeriodEnd="2018-10-25"
      />
    );
    await userEvent.click(screen.getByRole('button', {name: /On-Demand/}));
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));
    expect(screen.getByTestId('startTime')).toHaveValue('00:00');
    expect(screen.getByTestId('endTime')).toHaveValue('00:00');
  } finally {
    moment.tz.setDefault('UTC');
  }
});
