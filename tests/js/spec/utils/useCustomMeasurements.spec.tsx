import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';

function TestComponent({other}: {other: string}) {
  const {customMeasurements} = useCustomMeasurements();
  return (
    <div>
      <span>{other}</span>
      {customMeasurements &&
        Object.keys(customMeasurements).map(customMeasurement => (
          <em key={customMeasurement}>{customMeasurement}</em>
        ))}
    </div>
  );
}

function mockMeasurementsMeta() {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/measurements-meta/`,
    body: {
      'measurements.custom.measurement': {
        functions: ['p99'],
      },
      'measurements.another.custom.measurement': {
        functions: ['p99'],
      },
    },
  });
}

describe('useCustomMeasurements', function () {
  it('provides customMeasurements from the custom measurements context', async function () {
    const {organization} = initializeOrg({
      organization: {features: ['dashboards-mep']},
      project: undefined,
      projects: [],
      router: {},
    });
    const measurementsMetaMock = mockMeasurementsMeta();
    render(
      <CustomMeasurementsProvider organization={organization}>
        <TestComponent other="value" />
      </CustomMeasurementsProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(measurementsMetaMock).toHaveBeenCalledTimes(1);

    // Renders custom measurements
    expect(
      await screen.findByText('measurements.custom.measurement')
    ).toBeInTheDocument();
    expect(
      screen.getByText('measurements.another.custom.measurement')
    ).toBeInTheDocument();
  });
});
