import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import NewAutomationPage from './new';

describe('NewAutomationPage', () => {
  const organization = OrganizationFixture({
    features: ['seer-automations', 'service-accounts'],
  });
  const pathname = '/organizations/org-slug/seer/automations/new/';
  const metricSubtitle =
    'Connect metric monitors so Seer can investigate what caused a breach.';
  const scheduledSubtitle = 'Configure Seer to periodically investigate your issues.';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [],
    });
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'checkout-api'})]);
  });

  it('defaults to the Breached Metric form', () => {
    render(<NewAutomationPage />, {
      organization,
      initialRouterConfig: {location: {pathname}},
    });

    expect(screen.getByRole('button', {name: 'Breached Metric'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeInTheDocument();
    expect(screen.getByText(metricSubtitle)).toBeInTheDocument();
    expect(screen.queryByText('Environments')).not.toBeInTheDocument();
  });

  it('shows the Scheduled Investigation form for its strategy param', () => {
    render(<NewAutomationPage />, {
      organization,
      initialRouterConfig: {
        location: {pathname, query: {strategy: 'scheduled_investigation'}},
      },
    });

    expect(
      screen.getByRole('button', {name: 'Scheduled Investigation'})
    ).toBeInTheDocument();
    expect(screen.getByText('Environments')).toBeInTheDocument();
    expect(screen.getByText(scheduledSubtitle)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect monitors'})
    ).not.toBeInTheDocument();
  });

  it('writes the picked strategy to the URL and swaps the form', async () => {
    const {router} = render(<NewAutomationPage />, {
      organization,
      initialRouterConfig: {location: {pathname}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Breached Metric'}));
    await userEvent.click(screen.getByRole('option', {name: 'Scheduled Investigation'}));

    await waitFor(() =>
      expect(router.location.query.strategy).toBe('scheduled_investigation')
    );
    expect(screen.getByText('Environments')).toBeInTheDocument();
    expect(screen.getByText(scheduledSubtitle)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect monitors'})
    ).not.toBeInTheDocument();

    // Picking the default strategy keeps it in the URL
    await userEvent.click(screen.getByRole('button', {name: 'Scheduled Investigation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Breached Metric'}));

    await waitFor(() =>
      expect(router.location.query.strategy).toBe('breached_metric_investigation')
    );
    expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeInTheDocument();
    expect(screen.getByText(metricSubtitle)).toBeInTheDocument();
  });

  it('falls back to Breached Metric for an unknown strategy param', () => {
    render(<NewAutomationPage />, {
      organization,
      initialRouterConfig: {location: {pathname, query: {strategy: 'nonsense'}}},
    });

    expect(screen.getByRole('button', {name: 'Breached Metric'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect monitors'})).toBeInTheDocument();
    expect(screen.getByText(metricSubtitle)).toBeInTheDocument();
  });
});
