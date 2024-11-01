import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {useDismissable} from 'sentry/components/banner';
import {Button} from 'sentry/components/button';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import {IconClose} from 'sentry/icons';
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
    (isAnomaly: boolean) => {
      trackAnalytics('anomaly_detection.incident_banner_feedback_received', {
        is_anomaly: isAnomaly,
        organization,
        incident_id: id,
      });
      feedbackClient.captureEvent({
        request: {
          url: window.location.href, // gives the full url (origin + pathname)
        },
        tags: {
          featureName: 'anomaly-detection-alerts-feedback',
          project: selectedIncident.projects[0], // each metric alert is associated with precisely 1 project
          incident_identifier: selectedIncident.identifier,
          isAnomaly,
        },
        user: ConfigStore.get('user'),
        level: 'info',
        message: 'Escalating Issues Banner Feedback',
      });
      submit();
    },
    [id, organization, selectedIncident.identifier, selectedIncident.projects, submit]
  );

  if (isSubmitted) {
    return null;
  }
  return (
    <StyledAlert
      type="info"
      trailingItems={
        <Fragment>
          <Button onClick={() => handleClick(true)}>Yes</Button>
          <Button onClick={() => handleClick(false)}>No</Button>
          <CloseButton onClick={submit} aria-label={t('Close')} />
        </Fragment>
      }
      showIcon
    >
      {'Friends, Romans, countrymen, lend me your ears.' + selectedIncident.identifier}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin: 0;
`;

const CloseButton = styled(Button)`
  cursor: pointer;
  z-index: 1;
`;

CloseButton.defaultProps = {
  icon: <IconClose />,
  ['aria-label']: t('Close'),
  priority: 'link',
  borderless: true,
  size: 'xs',
};
