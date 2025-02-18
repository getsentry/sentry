import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {useDismissable} from 'sentry/components/banner';
import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
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
  const openFeedbackForm = useFeedbackForm();

  const handleClick = useCallback(
    (anomalyCorrectlyIdentified: boolean) => {
      trackAnalytics('anomaly-detection.feedback-submitted', {
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
      if (!anomalyCorrectlyIdentified && openFeedbackForm) {
        openFeedbackForm({
          messagePlaceholder: t('Why was this anomaly incorrect?'),
          tags: {
            ['feedback.source']: 'anomaly_detection_false_positive',
            ['feedback.owner']: 'ml-ai',
          },
        });
      }
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
      openFeedbackForm,
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
          <StyledButton borderless onClick={() => handleClick(true)}>
            {t('Yes')}
          </StyledButton>
          <StyledButton borderless onClick={() => handleClick(false)}>
            {t('No')}
          </StyledButton>
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
  color: ${p => p.theme.alert.info.color};
  border: 1px solid ${p => p.theme.alert.info.border};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.alert.info.color};
    border-color: ${p => p.theme.alert.info.borderHover};
  }
`;

const StyledAlert = styled(Alert)`
  padding-top: ${space(3)};
  padding-bottom: ${space(3)};
`;
