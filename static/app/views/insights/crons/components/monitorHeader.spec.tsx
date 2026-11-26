import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {MonitorHeader} from './monitorHeader';

describe('MonitorHeader', () => {
  const organization = OrganizationFixture();

  it('renders the monitor name as the title with filter-preserving parent links', async () => {
    const monitor = MonitorFixture({name: 'My Cron Job'});

    render(
      <MonitorHeader
        monitor={monitor}
        orgSlug={organization.slug}
        onUpdate={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/alerts/rules/crons/${monitor.project.slug}/${monitor.slug}/details/`,
            query: {project: '2', environment: 'prod', statsPeriod: '7d', foo: 'bar'},
          },
        },
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'My Cron Job', level: 1})
    ).toBeInTheDocument();

    const breadcrumbs = screen.getByRole('list');
    expect(within(breadcrumbs).getByRole('link', {name: 'Monitors'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/?environment=prod&project=2&statsPeriod=7d`
    );
    expect(
      within(breadcrumbs).getByRole('link', {name: 'Cron Monitors'})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/crons/?environment=prod&project=2&statsPeriod=7d`
    );
    expect(within(breadcrumbs).queryByText('My Cron Job')).not.toBeInTheDocument();
  });
});
