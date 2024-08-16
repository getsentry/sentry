import {IncidentFixture} from 'sentry-fixture/incident';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AlertLastIncidentActivationInfo from 'sentry/views/alerts/list/rules/alertLastIncidentActivationInfo';
import {CombinedAlertType, IncidentStatus} from 'sentry/views/alerts/types';

describe('AlertLastIncidentActivationInfo', function () {
  it('Renders non-triggered issue alert correctly', function () {
    const rule = {
      ...ProjectAlertRuleFixture(),
      type: CombinedAlertType.ISSUE,
    } as const;

    render(<AlertLastIncidentActivationInfo rule={rule} />);
    expect(screen.getByText('Alert not triggered yet')).toBeInTheDocument();
  });

  it('Renders triggered issue alert correctly', function () {
    const rule = {
      ...ProjectAlertRuleFixture({
        lastTriggered: '2017-10-17T00:00:00.000Z',
      }),
      type: CombinedAlertType.ISSUE,
    } as const;

    const {container} = render(<AlertLastIncidentActivationInfo rule={rule} />);
    expect(container).toHaveTextContent('Triggered 3 hours ago');
  });

  it('Renders non-triggered metric alerts', function () {
    const rule = {
      ...MetricRuleFixture(),
      type: CombinedAlertType.METRIC,
    } as const;

    render(<AlertLastIncidentActivationInfo rule={rule} />);
    expect(screen.getByText('Alert not triggered yet')).toBeInTheDocument();
  });

  it('Renders triggered metric alert incidents', function () {
    const rule = {
      ...MetricRuleFixture({
        latestIncident: IncidentFixture({
          status: IncidentStatus.CRITICAL,
          dateCreated: '2017-10-17T00:00:00.000Z',
        }),
      }),
      type: CombinedAlertType.METRIC,
    } as const;

    const {container} = render(<AlertLastIncidentActivationInfo rule={rule} />);
    expect(container).toHaveTextContent('Triggered 3 hours ago');
  });

  it('Renders uptime alerts', function () {
    const rule = {
      ...UptimeRuleFixture(),
      type: CombinedAlertType.UPTIME,
    } as const;

    render(<AlertLastIncidentActivationInfo rule={rule} />);
    expect(screen.getByText('Actively monitoring every 5 seconds')).toBeInTheDocument();
  });
});
