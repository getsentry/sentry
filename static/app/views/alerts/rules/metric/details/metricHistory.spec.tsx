import range from 'lodash/range';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MetricHistory from './metricHistory';

describe('MetricHistory', () => {
  it('renders empty state', () => {
    render(<MetricHistory incidents={[]} />);
    expect(screen.getByText('No alerts triggered during this time.')).toBeInTheDocument();
  });

  it('renders a critical incident', () => {
    render(<MetricHistory incidents={[TestStubs.Incident()]} />);
    expect(screen.getByRole('link', {name: '#123'})).toBeInTheDocument();
    expect(screen.getByText('Number of Errors above 70')).toBeInTheDocument();
    expect(screen.getByText('12hr')).toBeInTheDocument();
  });

  it('collapses the incidents panel if the number of incidents > 3', async () => {
    const incidents = range(0, 10).map(id =>
      TestStubs.Incident({id: `${id}`, identifier: `${id}`})
    );
    render(<MetricHistory incidents={incidents} />);
    expect(screen.getAllByRole('link').length).toBe(3);
    await userEvent.click(screen.getByRole('button', {name: 'Show 7 Hidden Alerts'}));
    expect(screen.getAllByRole('link').length).toBe(incidents.length);
  });
});
