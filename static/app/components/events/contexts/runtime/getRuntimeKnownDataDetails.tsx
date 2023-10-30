import {t} from 'sentry/locale';

import {RuntimeData, RuntimeKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

type Props = {
  data: RuntimeData;
  type: RuntimeKnownDataType;
};

export function getRuntimeKnownDataDetails({type, data}: Props): Output | undefined {
  switch (type) {
    case RuntimeKnownDataType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case RuntimeKnownDataType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}${data.build ? `(${data.build})` : ''}`,
      };
    default:
      return undefined;
  }
}
