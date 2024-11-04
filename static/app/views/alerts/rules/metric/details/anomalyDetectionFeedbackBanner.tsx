import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {useDismissable} from 'sentry/components/banner';
import {Button} from 'sentry/components/button';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Incident} from 'sentry/views/alerts/types';

interface AnomalyDetectionFeedbackProps {
  id: string;
  organization: Organization;
  selectedIncident: Incident;
}

export default function AnomalyDetectionFeedbackBanner({
  id,
  organization,
  selectedIncident,
}: AnomalyDetectionFeedbackProps) {
  const [isSubmitted, submit] = useDismissable(id);

  const handleClick = useCallback(
    (anomalyCorrectlyIdentified: boolean) => {
      trackAnalytics('anomaly_detection.submitted_feedback', {
        choice_selected: anomalyCorrectlyIdentified,
        organization,
        incident_id: id,
      });
      feedbackClient.captureEvent({
        request: {
          url: window.location.href, // gives the full url (origin + pathname)
        },
        tags: {
          featureName: 'anomaly-detection-alerts-feedback',
          choice_selected: anomalyCorrectlyIdentified,
          incident_id: id,
          alert_rule_id: selectedIncident.alertRule.id,
          metric: selectedIncident.alertRule.query,
          sensitivity: selectedIncident.alertRule.sensitivity,
          direction: selectedIncident.alertRule.thresholdType,
          time_window: selectedIncident.alertRule.timeWindow,
        },
        user: ConfigStore.get('user'),
        level: 'info',
        message: 'Anomaly Detection Alerts Banner Feedback',
      });
      submit();
    },
    [
      id,
      organization,
      selectedIncident.alertRule.id,
      selectedIncident.alertRule.query,
      selectedIncident.alertRule.sensitivity,
      selectedIncident.alertRule.thresholdType,
      selectedIncident.alertRule.timeWindow,
      submit,
    ]
  );

  if (isSubmitted) {
    return null;
  }
  return (
    <StyledAlert
      type="info"
      trailingItems={
        <Fragment>
          <StyledButton onClick={() => handleClick(true)}>{t('Yes')}</StyledButton>
          <StyledButton onClick={() => handleClick(false)}>{t('No')}</StyledButton>
        </Fragment>
      }
      showIcon
    >
      {t('Was the anomaly correctly identified?')}
    </StyledAlert>
  );
}

const StyledButton = styled(Button)`
  background-color: transparent;
  border: 1px solid ${p => p.theme.alert.info.border};
`;

const StyledAlert = styled(Alert)`
  margin: 0;
`;
