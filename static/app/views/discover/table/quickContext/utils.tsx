import type {Organization} from 'sentry/types/organization';
import type {EventData} from 'sentry/utils/discover/eventView';

export const tenSecondInMs = 10 * 1000;

export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
  EVENT = 'event',
}

export type BaseContextProps = {
  dataRow: EventData;
  organization: Organization;
};
