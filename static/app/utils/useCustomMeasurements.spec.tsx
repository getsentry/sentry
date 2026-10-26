import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useCustomMeasurements} from 'sentry/utils/useCustomMeasurements';

function TestComponent({other}: {other: string}) {
  const {customMeasurements} = useCustomMeasurements();
  return (
    <div>
      <span>{other}</span>
      {Object.keys(customMeasurements).map(customMeasurement => (
        <em key={customMeasurement}>{customMeasurement}</em>
      ))}
    </div>
  );
}

describe('useCustomMeasurements', () => {
  it('returns an empty collection without fetching measurements-meta', () => {
    const measurementsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: {
        'measurements.custom.measurement': {
          functions: ['p99'],
        },
      },
    });

    render(<TestComponent other="value" />);

    expect(screen.getByText('value')).toBeInTheDocument();
    expect(measurementsMetaMock).not.toHaveBeenCalled();
    expect(screen.queryByText('measurements.custom.measurement')).not.toBeInTheDocument();
  });
});
