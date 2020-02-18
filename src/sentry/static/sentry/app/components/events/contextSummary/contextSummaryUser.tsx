import React from 'react';

import {t} from 'app/locale';
import {Meta, EventUser} from 'app/types';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';
import UserAvatar from 'app/components/avatar/userAvatar';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';

import ContextSummaryNoSummary from './contextSummaryNoSummary';

type Props = {
  data: EventUser;
};

type UserTitle = {
  value: string;
  meta?: Meta;
};

const ContextSummaryUser = ({data}: Props) => {
  const user = removeFilterMaskedEntries(data);

  if (Object.keys(user).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const renderUserDetails = (key: 'id' | 'username') => {
    const value = user[key];

    const subject = key === 'id' ? t('ID:') : t('username:');
    const meta = getMeta(data, key);

    return (
      <p>
        <strong>{subject}</strong>
        {meta ? (
          <AnnotatedText
            value={value}
            chunks={meta.chunks}
            remarks={meta.rem}
            errors={meta.err}
          />
        ) : (
          value
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
            {userTitle?.meta ? (
              <AnnotatedText
                value={userTitle.value}
                chunks={userTitle.meta.chunks}
                remarks={userTitle.meta.rem}
                errors={userTitle.meta.err}
              />
            ) : (
              userTitle?.value
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
