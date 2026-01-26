import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AnomalyDetectionDisabledAlertMessage} from './anomalyDetectionDisabledAlert';

describe('AnomalyDetectionDisabledAlertMessage', () => {
  it('shows upgrade message for anomaly detector without feature', () => {
    const orgWithoutFeature = OrganizationFixture({features: []});
    const anomalyDetector = MetricDetectorFixture({
      config: {detectionType: 'dynamic'},
    });

    render(<AnomalyDetectionDisabledAlertMessage detector={anomalyDetector} />, {
      organization: orgWithoutFeature,
    });

    expect(
      screen.getByText(
        /Anomaly detection is only available on Business and Enterprise plans/
      )
    ).toBeInTheDocument();
  });

  it('returns null for non-anomaly detectors', () => {
    const orgWithoutFeature = OrganizationFixture({features: []});
    const thresholdDetector = MetricDetectorFixture({
      config: {detectionType: 'static'},
    });

    const {container} = render(
      <AnomalyDetectionDisabledAlertMessage detector={thresholdDetector} />,
      {
        organization: orgWithoutFeature,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when org has feature', () => {
    const orgWithFeature = OrganizationFixture({
      features: ['anomaly-detection-alerts'],
    });
    const anomalyDetector = MetricDetectorFixture({
      config: {detectionType: 'dynamic'},
    });

    const {container} = render(
      <AnomalyDetectionDisabledAlertMessage detector={anomalyDetector} />,
      {
        organization: orgWithFeature,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });
});
