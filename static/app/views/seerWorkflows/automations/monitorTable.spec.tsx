import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MonitorTable} from './monitorTable';

describe('MonitorTable', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      body: [],
    });
  });

  it("links to a monitor with the monitor's default time period", async () => {
    render(
      <MonitorTable
        monitors={[MetricDetectorFixture({id: '1', name: 'Checkout error rate'})]}
        renderAction={() => null}
      />,
      {organization}
    );

    // One-minute interval monitors chart up to 7 days.
    expect(
      await screen.findByRole('link', {name: /Checkout error rate/})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/1/?statsPeriod=7d`
    );
  });
});
