import React from 'react';

import {t} from 'app/locale';
import {AvatarUser as UserType} from 'app/types';
import ExternalLink from 'app/components/links/externalLink';

export enum UserKnownDataDetailsType {
  ID = 'id',
  EMAIL = 'email',
  USERNAME = 'username',
  IP_ADDRESS = 'ip_address',
  NAME = 'name',
}

const EMAIL_REGEX = /[^@]+@[^\.]+\..+/;

type Output = {
  subject: string;
  value: string | null | React.ReactNode;
  subjectIcon?: React.ReactNode;
};

function getUserKnownDataDetails(
  data: UserType,
  type: UserKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case UserKnownDataDetailsType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case UserKnownDataDetailsType.USERNAME:
      return {
        subject: t('Username'),
        value: data.username,
      };
    case UserKnownDataDetailsType.ID:
      return {
        subject: t('ID'),
        value: data.id,
      };
    case UserKnownDataDetailsType.EMAIL:
      return {
        subject: t('Email'),
        value: data.email,
        subjectIcon: EMAIL_REGEX.test(data.email) && (
          <ExternalLink href={`mailto:${data.email}`} className="external-icon">
            <em className="icon-envelope" />
          </ExternalLink>
        ),
      };
    default:
      return undefined;
  }
}

export default getUserKnownDataDetails;
