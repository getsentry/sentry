import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {AvatarUser as UserType} from 'sentry/types';
import {defined} from 'sentry/utils';

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
    <UserWidget>
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
    </UserWidget>
  );
}

const UserWidget = styled('div')`
  position: relative;
  margin-bottom: 20px;

  .avatar {
    width: 48px;
    height: 48px;
    position: absolute;
    top: 0;
    right: 0;
    box-shadow: 0 0 0 5px #fff;
    background: #fff;
    border-radius: 50% 0 50% 50%;
  }

  .table {
    margin-bottom: 0;
  }
`;

export default User;
