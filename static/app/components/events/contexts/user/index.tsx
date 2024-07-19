import UserAvatar from 'sentry/components/avatar/userAvatar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import type {Event} from 'sentry/types/event';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils';

import {
  getContextMeta,
  getKnownData,
  getKnownStructuredData,
  getUnknownData,
} from '../utils';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';

export type UserEventContextData = {
  data: Record<string, string>;
} & AvatarUser;

type Props = {
  data: UserEventContextData;
  event: Event;
  meta?: Record<string, any>;
};

export enum UserKnownDataType {
  ID = 'id',
  EMAIL = 'email',
  USERNAME = 'username',
  IP_ADDRESS = 'ip_address',
  NAME = 'name',
}

export enum UserIgnoredDataType {
  DATA = 'data',
}

export const userKnownDataValues = [
  UserKnownDataType.ID,
  UserKnownDataType.EMAIL,
  UserKnownDataType.USERNAME,
  UserKnownDataType.IP_ADDRESS,
  UserKnownDataType.NAME,
];

const userIgnoredDataValues = [UserIgnoredDataType.DATA];

export function getKnownUserContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getKnownData<UserEventContextData, UserKnownDataType>({
    data,
    meta,
    knownDataTypes: userKnownDataValues,
    onGetKnownDataDetails: v => getUserKnownDataDetails(v),
  }).map(v => ({
    ...v,
    subjectDataTestId: `user-context-${v.key.toLowerCase()}-value`,
  }));
}

export function getUnknownUserContextData({data, meta}: Pick<Props, 'data' | 'meta'>) {
  return getUnknownData({
    allData: data,
    knownKeys: [...userKnownDataValues, ...userIgnoredDataValues],
    meta,
  });
}
export function UserEventContext({data, event, meta: propsMeta}: Props) {
  const meta = propsMeta ?? getContextMeta(event, 'user');
  const knownData = getKnownUserContextData({data, meta});
  const knownStructuredData = getKnownStructuredData(knownData, meta);
  const unknownData = getUnknownUserContextData({data, meta});

  return (
    <div className="user-widget">
      <div className="pull-left">
        <UserAvatar user={removeFilterMaskedEntries(data)} size={48} gravatar={false} />
      </div>
      <ContextBlock data={knownStructuredData} />
      <ContextBlock data={unknownData} />
      {defined(data?.data) && (
        <ErrorBoundary mini>
          <KeyValueList
            data={Object.entries(data.data).map(([key, value]) => ({
              key,
              value,
              subject: key,
              meta: meta[key]?.[''],
            }))}
            isContextData
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
