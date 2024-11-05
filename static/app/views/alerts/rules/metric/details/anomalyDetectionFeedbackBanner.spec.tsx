import {IncidentFixture} from 'sentry-fixture/incident';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import * as analytics from 'sentry/utils/analytics';

import AnomalyDetectionFeedbackBanner from './anomalyDetectionFeedbackBanner';

describe('AnomalyDetectionFeedbackBanner', () => {
  const initialData = initializeOrg({
    organization: {
      features: [
        'metric-alert-threshold-period',
        'change-alerts',
        'anomaly-detection-alerts',
        'anomaly-detection-rollout',
      ],
    },
  });
  const organization = initialData.organization;
  const project = initialData.project;
  const mockIncident = IncidentFixture({projects: [project.slug]});
  const mockIncident2 = IncidentFixture({id: '6702'});
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  it('submits anomaly detection feedback (yes)', async () => {
    const {container} = render(
      <AnomalyDetectionFeedbackBanner
        id={mockIncident.id}
        organization={organization}
        selectedIncident={mockIncident}
      />
    );

    expect(screen.getByText(/Was the anomaly correctly identified?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Yes'}));

    expect(analyticsSpy).toHaveBeenCalledWith(
      'anomaly-detection.feedback-submitted',
      expect.objectContaining({
        choice_selected: true,
        organization,
        incident_id: mockIncident.id,
      })
    );

    expect(feedbackClient.captureEvent).toHaveBeenCalledWith({
      message: 'Anomaly Detection Alerts Banner Feedback',
      level: 'info',
      tags: {
        featureName: 'anomaly-detection-alerts-feedback',
        choice_selected: true,
        incident_id: mockIncident.id,
        alert_rule_id: mockIncident.alertRule.id,
        metric: mockIncident.alertRule.query,
        sensitivity: mockIncident.alertRule.sensitivity,
        direction: mockIncident.alertRule.thresholdType,
        time_window: mockIncident.alertRule.timeWindow,
      },
      request: expect.anything(),
      user: expect.anything(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('submits anomaly detection feedback (no)', async () => {
    const {container} = render(
      <AnomalyDetectionFeedbackBanner
        id={mockIncident2.id}
        organization={organization}
        selectedIncident={mockIncident2}
      />
    );

    expect(screen.getByText(/Was the anomaly correctly identified?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'No'}));

    expect(analyticsSpy).toHaveBeenCalledWith(
      'anomaly-detection.feedback-submitted',
      expect.objectContaining({
        choice_selected: false,
        organization,
        incident_id: mockIncident2.id,
      })
    );

    expect(feedbackClient.captureEvent).toHaveBeenCalledWith({
      message: 'Anomaly Detection Alerts Banner Feedback',
      level: 'info',
      tags: {
        featureName: 'anomaly-detection-alerts-feedback',
        choice_selected: false,
        incident_id: mockIncident2.id,
        alert_rule_id: mockIncident2.alertRule.id,
        metric: mockIncident2.alertRule.query,
        sensitivity: mockIncident2.alertRule.sensitivity,
        direction: mockIncident2.alertRule.thresholdType,
        time_window: mockIncident2.alertRule.timeWindow,
      },
      request: expect.anything(),
      user: expect.anything(),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
