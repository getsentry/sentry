import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import {UserEventContextData, UserKnownDataType} from '.';

const EMAIL_REGEX = /[^@]+@[^\.]+\..+/;

type Output = {
  subject: string;
  value: string | null;
  subjectIcon?: React.ReactNode;
};

type Props = {
  data: UserEventContextData;
  type: UserKnownDataType;
};

export function getUserKnownDataDetails({data, type}: Props): Output | undefined {
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
        subjectIcon: defined(data.email) && EMAIL_REGEX.test(data.email) && (
          <ExternalLink href={`mailto:${data.email}`} className="external-icon">
            <StyledIconMail size="xs" />
          </ExternalLink>
        ),
      };
    default:
      return undefined;
  }
}

const StyledIconMail = styled(IconMail)`
  vertical-align: middle;
`;
