import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BigNumberWidget} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidget';

describe('BigNumberWidget', () => {
  it('Renders formatted data', () => {
    render(
      <BigNumberWidget
        title="EPS"
        description="Number of events per second"
        data={[
          {
            'eps()': 0.01087819860850493,
          },
        ]}
        meta={{
          fields: {
            'eps()': 'rate',
          },
          units: {
            'eps()': '1/second',
          },
        }}
      />
    );

    expect(screen.getByText('EPS')).toBeInTheDocument();
    expect(screen.getByText('Number of events per second')).toBeInTheDocument();
    expect(screen.getByText('0.0109/s')).toBeInTheDocument();
  });
});
