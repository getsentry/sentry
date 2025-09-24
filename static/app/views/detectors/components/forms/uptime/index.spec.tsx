import {UptimeDetectorFixture} from 'tests/js/fixtures/detectors';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  EditExistingUptimeDetectorForm,
  NewUptimeDetectorForm,
} from 'sentry/views/detectors/components/forms/uptime';

describe('UptimeDetectorForm', () => {
  it('renders detect, warning, and respond sections for a new uptime detector', () => {
    render(<NewUptimeDetectorForm />);

    expect(screen.getByRole('combobox', {name: 'Interval'})).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', {name: 'Failure Tolerance'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', {name: 'Recovery Tolerance'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'By enabling uptime monitoring, you acknowledge that uptime check data may be stored outside your selected data region. Learn more.'
      )
    ).toBeInTheDocument();
  });

  it('populates saved threshold values when editing an existing detector', () => {
    const detector = UptimeDetectorFixture({
      config: {
        downtimeThreshold: 5,
        recoveryThreshold: 2,
        environment: 'prod',
        mode: 1,
      },
    });

    render(<EditExistingUptimeDetectorForm detector={detector} />);

    expect(screen.getByRole('spinbutton', {name: 'Failure Tolerance'})).toHaveValue(5);
    expect(screen.getByRole('spinbutton', {name: 'Recovery Tolerance'})).toHaveValue(2);
  });
});
