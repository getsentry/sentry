import range from 'lodash/range';
import {IncidentFixture} from 'sentry-fixture/incident';

// import {MetricRuleActivationFixture} from 'sentry-fixture/metricRuleActivation';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MetricHistory from './metricHistory';

describe('MetricHistory', () => {
  it('renders empty state', () => {
    render(<MetricHistory incidents={[]} />);
    expect(screen.getByText('No alerts triggered during this time.')).toBeInTheDocument();
  });

  it('renders a critical incident', () => {
    render(<MetricHistory incidents={[IncidentFixture()]} />);
    expect(screen.getByRole('link', {name: '#123'})).toBeInTheDocument();
    expect(
      screen.getByText('Number of errors above 70 within 1 hour')
    ).toBeInTheDocument();
    expect(screen.getByText('12hr')).toBeInTheDocument();
  });

  it('renders a critical % change incident', () => {
    const incident = IncidentFixture();
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
      IncidentFixture({id: `${id}`, identifier: `${id}`})
    );
    render(<MetricHistory incidents={incidents} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', {name: 'Show 7 Hidden Alerts'}));
    expect(screen.getAllByRole('link')).toHaveLength(incidents.length);
  });

  it('filters incidents with no activities (unexpected behavior)', () => {
    const incidents = [IncidentFixture({activities: []})];
    render(<MetricHistory incidents={incidents} />);
    expect(screen.getByText('No alerts triggered during this time.')).toBeInTheDocument();
  });

  // it('renders activation starts and ends', () => {
  //   // render 1 activation that has completed
  //   // render 1 activation that has not finished yet
  //   const activations = [
  //     MetricRuleActivationFixture({
  //       id: `1`,
  //       activator: '1',
  //       dateCreated: '2024-05-02T12:00:00.123Z',
  //       isComplete: true,
  //       finishedAt: '2024-05-02T13:00:00.123Z',
  //     }),
  //     MetricRuleActivationFixture({
  //       id: `2`,
  //       activator: '2',
  //       dateCreated: '2024-05-02T17:00:00.123Z',
  //     }),
  //   ];
  //   render(<MetricHistory incidents={[]} activations={activations} />);

  //   expect(screen.getAllByText('Start monitoring.').length).toBe(2);
  //   expect(screen.getAllByText('Finish monitoring.').length).toBe(1);
  // });
});
