import React from 'react';

import {t} from 'app/locale';
import {Meta, EventUser} from 'app/types';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';
import UserAvatar from 'app/components/avatar/userAvatar';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import styled from '@emotion/styled';
import space from 'app/styles/space';

import ContextSummaryNoSummary from './contextSummaryNoSummary';

type Props = {
  data: EventUser;
};

type UserTitle = {
  value: string;
  meta?: Meta;
};

type UserDetails = {
  subject: string;
  value: string;
  meta?: Meta;
};

const ContextSummaryUser = ({data}: Props) => {
  const user = removeFilterMaskedEntries(data);

  if (Object.keys(user).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const renderUserDetails = (key: 'id' | 'username') => {
    const userDetails: UserDetails = {
      subject: t('Username:'),
      value: user.username,
      meta: getMeta(data, 'username'),
    };

    if (key === 'id') {
      userDetails.subject = t('ID:');
      userDetails.value = user.id;
      userDetails.meta = getMeta(data, 'id');
    }

    return (
      <p>
        <Subject>{userDetails.subject}</Subject>
        {userDetails.meta ? (
          <AnnotatedText
            value={userDetails.value}
            chunks={userDetails.meta.chunks}
            remarks={userDetails.meta.rem}
            errors={userDetails.meta.err}
          />
        ) : (
          userDetails.value
        )}
      </p>
    );
  };

  const getUserTitle = (): UserTitle | undefined => {
    if (user.email) {
      return {
        value: user.email,
        meta: getMeta(data, 'email'),
      };
    }

    if (user.ip_address) {
      return {
        value: user.ip_address,
        meta: getMeta(data, 'ip_address'),
      };
    }

    if (user.id) {
      return {
        value: user.id,
        meta: getMeta(data, 'id'),
      };
    }

    if (user.username) {
      return {
        value: user.username,
        meta: getMeta(data, 'username'),
      };
    }

    return undefined;
  };

  const userTitle = getUserTitle();

  if (!userTitle) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  return (
    <div className="context-item user">
      {userTitle ? (
        <React.Fragment>
          <UserAvatar
            user={user}
            size={48}
            className="context-item-icon"
            gravatar={false}
          />
          <h3 data-test-id="user-title">
            {userTitle.meta ? (
              <AnnotatedText
                value={userTitle.value}
                chunks={userTitle.meta.chunks}
                remarks={userTitle.meta.rem}
                errors={userTitle.meta.err}
              />
            ) : (
              userTitle.value
            )}
          </h3>
        </React.Fragment>
      ) : (
        <span className="context-item-icon" />
      )}
      {user.id && user.id !== userTitle?.value
        ? renderUserDetails('id')
        : user.username &&
          user.username !== userTitle?.value &&
          renderUserDetails('username')}
    </div>
  );
};

export default ContextSummaryUser;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
