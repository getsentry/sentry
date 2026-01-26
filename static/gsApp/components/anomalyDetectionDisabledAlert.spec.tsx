import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AnomalyDetectionDisabledAlert} from './anomalyDetectionDisabledAlert';

describe('AnomalyDetectionDisabledAlert', () => {
  it('shows upgrade message for anomaly detector without feature', () => {
    const orgWithoutFeature = OrganizationFixture({features: []});
    const anomalyDetector = MetricDetectorFixture({
      config: {detectionType: 'dynamic'},
    });

    render(<AnomalyDetectionDisabledAlert detector={anomalyDetector} />, {
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
      <AnomalyDetectionDisabledAlert detector={thresholdDetector} />,
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
      <AnomalyDetectionDisabledAlert detector={anomalyDetector} />,
      {
        organization: orgWithFeature,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });
});
