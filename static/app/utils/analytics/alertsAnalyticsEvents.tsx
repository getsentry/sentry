export type AlertsEventParameters = {
  'anomaly-detection.feedback-submitted': {
    choice_selected: boolean;
    incident_id: string;
  };
};

export type AlertsEventKey = keyof AlertsEventParameters;

export const alertsEventMap: Record<AlertsEventKey, string | null> = {
  'anomaly-detection.feedback-submitted': 'Anomaly Detection Feedback Submitted',
};
