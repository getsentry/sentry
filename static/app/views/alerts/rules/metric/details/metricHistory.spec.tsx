import range from 'lodash/range';
import {Incident} from 'sentry-fixture/incident';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MetricHistory from './metricHistory';

describe('MetricHistory', () => {
  it('renders empty state', () => {
    render(<MetricHistory incidents={[]} />);
    expect(screen.getByText('No alerts triggered during this time.')).toBeInTheDocument();
  });

  it('renders a critical incident', () => {
    render(<MetricHistory incidents={[Incident()]} />);
    expect(screen.getByRole('link', {name: '#123'})).toBeInTheDocument();
    expect(screen.getByText('Number of errors above 70 in 1 hour')).toBeInTheDocument();
    expect(screen.getByText('12hr')).toBeInTheDocument();
  });

  it('renders a critical % change incident', () => {
    const incident = Incident();
    incident.alertRule.comparisonDelta = 60;
    render(<MetricHistory incidents={[incident]} />);
    expect(
      screen.getByText(
        'Number of errors 70% higher in 1 hour compared to the same time one hour ago'
      )
    ).toBeInTheDocument();
  });

  it('collapses the incidents panel if the number of incidents > 3', async () => {
    const incidents = range(0, 10).map(id =>
      Incident({id: `${id}`, identifier: `${id}`})
    );
    render(<MetricHistory incidents={incidents} />);
    expect(screen.getAllByRole('link').length).toBe(3);
    await userEvent.click(screen.getByRole('button', {name: 'Show 7 Hidden Alerts'}));
    expect(screen.getAllByRole('link').length).toBe(incidents.length);
  });

  it('filters incidents with no activities (unexpected behavior)', () => {
    const incidents = [Incident({activities: []})];
    render(<MetricHistory incidents={incidents} />);
    expect(screen.getByText('No alerts triggered during this time.')).toBeInTheDocument();
  });
});
