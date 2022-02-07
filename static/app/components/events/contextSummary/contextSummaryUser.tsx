import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AvatarUser, Meta} from 'sentry/types';
import {EventUser} from 'sentry/types/event';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import Item from './item';

type Props = {
  data: EventUser;
};

type UserTitle = {
  value: string;
  meta?: Meta;
};

type UserDetails = {
  subject: string;
  meta?: Meta;
  value?: string;
};

const ContextSummaryUser = ({data}: Props) => {
  const user = removeFilterMaskedEntries(data);

  if (Object.keys(user).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const renderUserDetails = (key: 'id' | 'username') => {
    const userDetails: UserDetails = {
      subject: t('Username:'),
      value: user.username ?? '',
      meta: getMeta(data, 'username'),
    };

    if (key === 'id') {
      userDetails.subject = t('ID:');
      userDetails.value = user.id;
      userDetails.meta = getMeta(data, 'id');
    }

    return (
      <TextOverflow isParagraph data-test-id="context-sub-title">
        <Subject>{userDetails.subject}</Subject>
        <AnnotatedText value={userDetails.value} meta={userDetails.meta} />
      </TextOverflow>
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

  const icon = userTitle ? (
    <UserAvatar
      user={user as AvatarUser}
      size={32}
      className="context-item-icon"
      gravatar={false}
    />
  ) : (
    <span className="context-item-icon" />
  );

  return (
    <Item className="user" icon={icon}>
      {userTitle && (
        <h3 data-test-id="user-title">
          <AnnotatedText value={userTitle.value} meta={userTitle.meta} />
        </h3>
      )}
      {user.id && user.id !== userTitle?.value
        ? renderUserDetails('id')
        : user.username &&
          user.username !== userTitle?.value &&
          renderUserDetails('username')}
    </Item>
  );
};

export default ContextSummaryUser;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
