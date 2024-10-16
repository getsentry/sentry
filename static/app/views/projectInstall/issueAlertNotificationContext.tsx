import {createContext, useContext} from 'react';

import type {IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';

export type IssueAlertNotificationContextValue = {
  alertNotificationAction: IssueAlertActionType[];
  alertNotificationChannel: string | undefined;
  alertNotificationIntegration: OrganizationIntegration | undefined;
  alertNotificationProvider: string | undefined;
  setAlertNotificationAction: (method: IssueAlertActionType[]) => void;
  setAlertNotificationChannel: (channel: string | undefined) => void;
  setAlertNotificationIntegration: (
    integration: OrganizationIntegration | undefined
  ) => void;
  setAlertNotificationProvider: (provider: string | undefined) => void;
};

export const IssueAlertNotificationContext =
  createContext<IssueAlertNotificationContextValue | null>(null);

export function useIssueAlertNotificationContext(): IssueAlertNotificationContextValue {
  const context = useContext(IssueAlertNotificationContext);

  if (!context) {
    throw new Error(
      'useIssueAlertNotificationContext must be used within a IssueAlertNotificationContext.Provider'
    );
  }

  return context;
}
