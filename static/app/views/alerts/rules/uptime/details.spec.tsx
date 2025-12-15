import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UptimeSummaryFixture} from 'sentry-fixture/uptimeSummary';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import UptimeAlertDetails from './details';

describe('UptimeAlertDetails', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const getInitialRouterConfig = (detectorId: string) => ({
    location: {
      pathname: `/organizations/${organization.slug}/alerts/rules/uptime/${project.slug}/${detectorId}/details/`,
    },
    route: '/organizations/:orgId/alerts/rules/uptime/:projectId/:detectorId/details/',
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/3/checks/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-summary/',
      body: {
        '3': UptimeSummaryFixture(),
      },
    });
  });

  it('renders', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/3/`,
      body: UptimeDetectorFixture({name: 'Uptime Test Rule'}),
    });

    render(<UptimeAlertDetails />, {
      organization,
      initialRouterConfig: getInitialRouterConfig('3'),
    });
    expect(await screen.findByText('Uptime Test Rule')).toBeInTheDocument();
  });

  // HOTFIX: monitor_names_missing_default
  // Auto-detected monitors were created without names. This test ensures the
  // fallback name is displayed correctly.
  it('renders with fallback name when monitor name is empty', async () => {
    const detector = UptimeDetectorFixture({name: ''});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/3/`,
      body: detector,
    });

    render(<UptimeAlertDetails />, {
      organization,
      initialRouterConfig: getInitialRouterConfig('3'),
    });

    const expectedName = `Uptime Monitoring for ${detector.dataSources[0].queryObj.url}`;
    expect(await screen.findByText(expectedName)).toBeInTheDocument();
  });

  it('shows a message for invalid uptime alert', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/2/`,
      statusCode: 404,
    });

    render(<UptimeAlertDetails />, {
      organization,
      initialRouterConfig: getInitialRouterConfig('2'),
    });
    expect(
      await screen.findByText('The uptime alert rule you were looking for was not found.')
    ).toBeInTheDocument();
  });

  it('disables and enables the rule', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/2/`,
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/3/`,
      body: UptimeDetectorFixture({name: 'Uptime Test Rule'}),
    });

    render(<UptimeAlertDetails />, {
      organization,
      initialRouterConfig: getInitialRouterConfig('3'),
    });
    await screen.findByText('Uptime Test Rule');

    const disableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/3/`,
      method: 'PUT',
      body: UptimeDetectorFixture({name: 'Uptime Test Rule', enabled: false}),
    });

    const disableButtons = await screen.findAllByRole('button', {
      name: 'Disable this uptime rule and stop performing checks',
    });
    await userEvent.click(disableButtons[0]!);

    expect(disableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {status: 'disabled'}})
    );

    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/3/`,
      method: 'PUT',
      body: UptimeDetectorFixture({name: 'Uptime Test Rule', enabled: true}),
    });

    // Button now re-enables the monitor
    const enabledButtons = await screen.findAllByRole('button', {
      name: 'Enable this uptime rule',
    });
    await userEvent.click(enabledButtons[0]!);

    expect(enableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {status: 'active'}})
    );
  });
});
