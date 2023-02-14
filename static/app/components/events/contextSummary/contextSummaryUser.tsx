import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {removeFilterMaskedEntries} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarUser, Meta} from 'sentry/types';
import {EventUser} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import Item from './item';
import {ContextItemProps} from './types';

type UserTitle = {
  value: string;
  meta?: Meta;
};

type UserDetails = {
  subject: string;
  meta?: Meta;
  value?: string;
};

type Props = ContextItemProps<EventUser, 'user'>;

export function ContextSummaryUser({data, meta}: Props) {
  const user = removeFilterMaskedEntries(data);

  if (Object.keys(user).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const renderUserDetails = (key: 'id' | 'username') => {
    const userDetails: UserDetails = {
      subject: t('Username:'),
      value: user.username ?? '',
      meta: meta.username?.[''],
    };

    if (key === 'id') {
      userDetails.subject = t('ID:');
      userDetails.value = user.id;
      userDetails.meta = meta.id?.[''];
    }

    return (
      <TextOverflow isParagraph data-test-id="context-sub-title">
        <Subject>{userDetails.subject}</Subject>
        <AnnotatedText value={userDetails.value} meta={userDetails.meta} />
      </TextOverflow>
    );
  };

  const getUserTitle = (): UserTitle | undefined => {
    if (defined(user.email)) {
      return {
        value: user.email,
        meta: meta.email?.[''],
      };
    }

    if (defined(user.ip_address)) {
      return {
        value: user.ip_address,
        meta: meta.ip_address?.[''],
      };
    }

    if (defined(user.id)) {
      return {
        value: user.id,
        meta: meta.id?.[''],
      };
    }

    if (defined(user.username)) {
      return {
        value: user.username,
        meta: meta.username?.[''],
      };
    }

    return undefined;
  };

  const userTitle = getUserTitle();

  if (!userTitle) {
    return <ContextSummaryNoSummary title={t('Unknown User')} />;
  }

  const icon = userTitle ? (
    <UserAvatar user={user as AvatarUser} size={32} gravatar={false} />
  ) : (
    'unknown'
  );

  return (
    <Item icon={icon}>
      {userTitle && (
        <h3 data-test-id="user-title">
          <AnnotatedText value={userTitle.value} meta={userTitle.meta} />
        </h3>
      )}
      {defined(user.id) && user.id !== userTitle?.value
        ? renderUserDetails('id')
        : user.username &&
          user.username !== userTitle?.value &&
          renderUserDetails('username')}
    </Item>
  );
}

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
