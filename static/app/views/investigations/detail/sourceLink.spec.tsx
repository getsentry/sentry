import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InvestigationSourceLink} from 'sentry/views/investigations/detail/sourceLink';

const organization = OrganizationFixture({slug: 'org-slug'});

describe('InvestigationSourceLink', () => {
  it('links a breached metric investigation to its issue by monitor name', () => {
    render(
      <InvestigationSourceLink
        investigation={{
          sourceType: 'metric_open_period',
          source: {
            type: 'metric_open_period',
            ref: {groupId: '123', openPeriodId: '456'},
            snapshot: {monitor: {id: '789', name: 'Checkout error rate'}},
          },
        }}
      />,
      {organization}
    );

    expect(screen.getByRole('link', {name: 'Checkout error rate'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/'
    );
  });

  it('falls back to "View issue" without a monitor snapshot', () => {
    render(
      <InvestigationSourceLink
        investigation={{
          sourceType: 'metric_open_period',
          source: {type: 'metric_open_period', ref: {groupId: '123'}},
        }}
      />,
      {organization}
    );

    expect(screen.getByRole('link', {name: 'View issue'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/'
    );
  });

  it('names a manual investigation without a link', () => {
    render(
      <InvestigationSourceLink
        investigation={{sourceType: 'manual', source: {type: 'manual', ref: {}}}}
      />,
      {organization}
    );

    expect(screen.getByText('Manual investigation')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('names a source type it cannot link to', () => {
    render(
      <InvestigationSourceLink
        investigation={{sourceType: 'dashboard_widget', source: {ref: {}}}}
      />,
      {organization}
    );

    expect(screen.getByText('dashboard widget')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
