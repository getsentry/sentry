import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MobileOverviewTable} from 'sentry/views/insights/pages/mobile/mobileOverviewTable';
import {DEFAULT_SORT} from 'sentry/views/insights/pages/mobile/settings';

const EMPTY_RESPONSE = {
  data: [],
  isLoading: false,
  meta: {fields: {}, units: {}},
};

describe('MobileOverviewTable', () => {
  it('links the Time Spent header to the ascending sort when it is the active sort', () => {
    render(<MobileOverviewTable response={EMPTY_RESPONSE} sort={DEFAULT_SORT} />, {
      organization: OrganizationFixture(),
    });

    const header = screen.getByRole('columnheader', {name: /time spent/i});
    const link = screen.getByRole('link', {name: /time spent/i});

    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('sort=sum%28span.duration%29')
    );
  });

  it('links the Time Spent header to the descending sort when another column is sorted', () => {
    render(
      <MobileOverviewTable
        response={EMPTY_RESPONSE}
        sort={{field: 'count_unique(user)', kind: 'desc'}}
      />,
      {organization: OrganizationFixture()}
    );

    const header = screen.getByRole('columnheader', {name: /time spent/i});
    const link = screen.getByRole('link', {name: /time spent/i});

    expect(header).not.toHaveAttribute('aria-sort');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('sort=-sum%28span.duration%29')
    );
  });
});
