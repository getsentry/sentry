import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProfilingMeasurements} from 'sentry/components/events/interfaces/spans/profilingMeasurements';

const mockProfileData = {
  measurements: {
    cpu_usage: {
      unit: 'percent',
      values: [
        {
          elapsed_since_start_ns: 0,
          value: 0,
        },
        {
          elapsed_since_start_ns: 1000,
          value: 12.0,
        },
      ],
    },
    memory_footprint: {
      unit: 'bytes',
      values: [
        {
          elapsed_since_start_ns: 0,
          value: 20000,
        },
        {
          elapsed_since_start_ns: 1000,
          value: 123456,
        },
      ],
    },
  },
} as Profiling.ProfileInput;

it('renders CPU Usage as a chart', function () {
  render(
    <ProfilingMeasurements profileData={mockProfileData} transactionDuration={2000} />
  );

  expect(screen.getByText('CPU Usage')).toBeInTheDocument();
  expect(screen.getByTestId('profile-measurements-chart-cpu_usage')).toBeInTheDocument();
});

it('can toggle between CPU Usage and Memory charts', async function () {
  render(
    <ProfilingMeasurements profileData={mockProfileData} transactionDuration={2000} />
  );

  await userEvent.click(screen.getByText('CPU Usage'));
  await userEvent.click(screen.getByText('Memory'));
  expect(
    screen.getByTestId('profile-measurements-chart-memory_footprint')
  ).toBeInTheDocument();
});
