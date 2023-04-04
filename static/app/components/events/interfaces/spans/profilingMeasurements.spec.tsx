import {render, screen} from 'sentry-test/reactTestingLibrary';

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
          elapsed_since_start_ns: 1000000000,
          value: 12.0,
        },
      ],
    },
  },
} as Profiling.ProfileInput;

it('renders CPU Usage as a chart', function () {
  render(<ProfilingMeasurements profileData={mockProfileData} />);

  expect(screen.getByText('CPU Usage')).toBeInTheDocument();
  expect(screen.getByTestId('profile-measurements-chart')).toBeInTheDocument();
});
