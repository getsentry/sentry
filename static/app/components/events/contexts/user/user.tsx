import UserAvatar from 'app/components/avatar/userAvatar';
import ErrorBoundary from 'app/components/errorBoundary';
import ContextBlock from 'app/components/events/contexts/contextBlock';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {AvatarUser as UserType} from 'app/types';
import {defined} from 'app/utils';

import getUnknownData from '../getUnknownData';

import getUserKnownData from './getUserKnownData';
import {UserIgnoredDataType, UserKnownDataType} from './types';

type Props = {
  data: Data;
};

type Data = {
  data: Record<string, string>;
} & UserType;

const userKnownDataValues = [
  UserKnownDataType.ID,
  UserKnownDataType.EMAIL,
  UserKnownDataType.USERNAME,
  UserKnownDataType.IP_ADDRESS,
  UserKnownDataType.NAME,
];

const userIgnoredDataValues = [UserIgnoredDataType.DATA];

function User({data}: Props) {
  return (
    <div className="user-widget">
      <div className="pull-left">
        <UserAvatar user={removeFilterMaskedEntries(data)} size={48} gravatar={false} />
      </div>
      <ContextBlock data={getUserKnownData(data, userKnownDataValues)} />
      <ContextBlock
        data={getUnknownData(data, [...userKnownDataValues, ...userIgnoredDataValues])}
      />
      {defined(data?.data) && (
        <ErrorBoundary mini>
          <KeyValueList
            data={Object.entries(data.data).map(([key, value]) => ({
              key,
              value,
              subject: key,
              meta: getMeta(data.data, key),
            }))}
            isContextData
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default User;
