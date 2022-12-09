import {Organization} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';

export const fiveMinutesInMs = 5 * 60 * 1000;

export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
  EVENT = 'event',
}

export type BaseContextProps = {
  dataRow: EventData;
  organization: Organization;
};
