import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CombinedAlertBadge from 'sentry/views/alerts/list/rules/combinedAlertBadge';
import {CombinedAlertType} from 'sentry/views/alerts/types';

describe('CombinedAlertBadge', function () {
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
