import UserAvatar from 'sentry/components/avatar/userAvatar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import {AvatarUser} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getKnownData, getUnknownData} from '../utils';

import {getUserKnownDataDetails} from './getUserKnownDataDetails';

export type UserEventContextData = {
  data: Record<string, string>;
} & AvatarUser;

type Props = {
  data: UserEventContextData;
  event: Event;
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

export function UserEventContext({data, event}: Props) {
  const meta = event._meta?.user ?? event._meta?.contexts?.user ?? {};

  return (
    <div className="user-widget">
      <div className="pull-left">
        <UserAvatar user={removeFilterMaskedEntries(data)} size={48} gravatar={false} />
      </div>
      <ContextBlock
        data={getKnownData<UserEventContextData, UserKnownDataType>({
          data,
          meta,
          knownDataTypes: userKnownDataValues,
          onGetKnownDataDetails: v => getUserKnownDataDetails(v),
        }).map(v => ({
          ...v,
          subjectDataTestId: `user-context-${v.key.toLowerCase()}-value`,
        }))}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...userKnownDataValues, ...userIgnoredDataValues],
          meta,
        })}
      />
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
