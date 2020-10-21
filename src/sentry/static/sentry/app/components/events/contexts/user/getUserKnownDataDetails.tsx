import * as React from 'react';

import {t} from 'app/locale';
import {IconMail} from 'app/icons';
import {AvatarUser as UserType} from 'app/types';
import ExternalLink from 'app/components/links/externalLink';

import {UserKnownDataType} from './types';

const EMAIL_REGEX = /[^@]+@[^\.]+\..+/;

type Output = {
  subject: string;
  value: string | null;
  subjectIcon?: React.ReactNode;
};

function getUserKnownDataDetails(
  data: UserType,
  type: UserKnownDataType
): Output | undefined {
  switch (type) {
    case UserKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case UserKnownDataType.USERNAME:
      return {
        subject: t('Username'),
        value: data.username,
      };
    case UserKnownDataType.ID:
      return {
        subject: t('ID'),
        value: data.id,
      };
    case UserKnownDataType.IP_ADDRESS:
      return {
        subject: t('IP Address'),
        value: data.ip_address,
      };
    case UserKnownDataType.EMAIL:
      return {
        subject: t('Email'),
        value: data.email,
        subjectIcon: EMAIL_REGEX.test(data.email) && (
          <ExternalLink href={`mailto:${data.email}`} className="external-icon">
            <IconMail size="xs" />
          </ExternalLink>
        ),
      };
    default:
      return undefined;
  }
}

export default getUserKnownDataDetails;
