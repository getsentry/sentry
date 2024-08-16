import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {MetricRuleActivationFixture} from 'sentry-fixture/metricRuleActivation';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorType} from 'sentry/types/alerts';
import CombinedAlertBadge from 'sentry/views/alerts/list/rules/combinedAlertBadge';
import {CombinedAlertType} from 'sentry/views/alerts/types';

describe('CombinedAlertBadge', function () {
  it('Renders correctly for waiting metric alert rules', async function () {
    const rule = {
      ...MetricRuleFixture({monitorType: MonitorType.ACTIVATED}),
      // Cast here to inform typescript that this will always be a metric type rule
      type: CombinedAlertType.METRIC as CombinedAlertType.METRIC,
    };

    render(<CombinedAlertBadge rule={rule} />);

    await userEvent.hover(screen.getByTestId('alert-badge'));

    // Renders tooltip with correct text
    expect(
      await screen.findByText('Metric Alert Status: Ready to monitor')
    ).toBeInTheDocument();
  });

  it('Renders correctly for monitoring metric alert rules', async function () {
    const rule = {
      ...MetricRuleFixture({monitorType: MonitorType.ACTIVATED}),
      activations: [MetricRuleActivationFixture()],
      type: CombinedAlertType.METRIC as CombinedAlertType.METRIC,
    };

    render(<CombinedAlertBadge rule={rule} />);

    await userEvent.hover(screen.getByTestId('alert-badge'));

    // Renders tooltip with correct text
    expect(
      await screen.findByText('Metric Alert Status: Monitoring')
    ).toBeInTheDocument();
  });

  it('Renders correctly for metric alert rules', async function () {
    const rule = {
      ...MetricRuleFixture(),
      type: CombinedAlertType.METRIC as CombinedAlertType.METRIC,
    };

    render(<CombinedAlertBadge rule={rule} />);

    await userEvent.hover(screen.getByTestId('alert-badge'));

    // Renders tooltip with correct text
    expect(await screen.findByText('Metric Alert Status: Resolved')).toBeInTheDocument();
  });

  it('Renders correctly for issue alert rules', async function () {
    const rule = {
      ...ProjectAlertRuleFixture(),
      type: CombinedAlertType.ISSUE as CombinedAlertType.ISSUE,
    };

    render(<CombinedAlertBadge rule={rule} />);

    await userEvent.hover(screen.getByTestId('alert-badge'));

    // Renders tooltip with correct text
    expect(await screen.findByText('Issue Alert')).toBeInTheDocument();
  });
});
