import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EAPSidebarCharts} from './eapSidebarCharts';

describe('EAPSidebarCharts', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'failure_rate()',
            values: [{timestamp: 1000000, value: 0.05}],
            meta: {interval: 3600, valueType: 'percentage', valueUnit: null},
          },
        ],
      },
    });
  });

  it('renders Web Vitals widget when hasWebVitals is true', async () => {
    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals />);
    expect(await screen.findByText('Web Vitals')).toBeInTheDocument();
    expect(await screen.findByText('Failure Rate')).toBeInTheDocument();
  });

  it('does not render Web Vitals widget when hasWebVitals is false', async () => {
    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals={false} />);
    expect(await screen.findByText('Failure Rate')).toBeInTheDocument();
    expect(screen.queryByText('Web Vitals')).not.toBeInTheDocument();
  });

  it('renders web vitals with correct values and state icons', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p75(measurements.fcp)': 500, // Good: <= 1000
            'p75(measurements.lcp)': 3000, // Meh: > 2500, <= 4000
            'p75(measurements.cls)': 0.35, // Poor: > 0.25
            'p75(measurements.inp)': null, // Missing
            'p75(measurements.ttfb)': 700, // Good: <= 800
          },
        ],
      },
      match: [
        (_url: string, options: Record<string, any>) =>
          Array.isArray(options.query?.field) &&
          options.query.field.includes('p75(measurements.fcp)'),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'failure_rate()': 0.05}],
      },
      match: [
        (_url: string, options: Record<string, any>) =>
          Array.isArray(options.query?.field) &&
          options.query.field.includes('failure_rate()'),
      ],
    });

    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals />);

    // FCP - Good: value shown with IconHappy
    expect(await screen.findByText('500.00ms')).toBeInTheDocument();
    const fcpRow = screen.getByText('500.00ms').parentElement!;
    expect(within(fcpRow).getByText('FCP')).toBeInTheDocument();
    expect(
      within(fcpRow).getByRole('img').querySelector('path')?.getAttribute('d')
    ).toContain('5 9H11');

    // LCP - Meh: value shown with IconMeh
    const lcpRow = screen.getByText('3.00s').parentElement!;
    expect(within(lcpRow).getByText('LCP')).toBeInTheDocument();
    expect(
      within(lcpRow).getByRole('img').querySelector('path')?.getAttribute('d')
    ).toContain('10.25 9.5');

    // CLS - Poor: value shown with IconSad
    const clsRow = screen.getByText('0.35').parentElement!;
    expect(within(clsRow).getByText('CLS')).toBeInTheDocument();
    expect(
      within(clsRow).getByRole('img').querySelector('path')?.getAttribute('d')
    ).toContain('10.34 11 12H5');

    // INP - Missing: em-dash shown, no icon
    const inpLabel = screen.getByText('INP');
    const inpRow = inpLabel.parentElement!;
    expect(within(inpRow).getByText('\u2014')).toBeInTheDocument();
    expect(within(inpRow).queryByRole('img')).not.toBeInTheDocument();

    // TTFB - value shown
    expect(screen.getByText('TTFB')).toBeInTheDocument();
    expect(screen.getByText('700.00ms')).toBeInTheDocument();
  });
});
