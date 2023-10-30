import {t} from 'sentry/locale';

import {EventExtraData, EventExtraDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

export function getEventExtraDataKnownDataDetails({
  data,
  type,
}: {
  data: EventExtraData;
  type: EventExtraDataType;
}): Output {
  switch (type) {
    case EventExtraDataType.CRASHED_PROCESS:
      return {
        subject: t('Crashed Process'),
        value: data[type],
      };
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}
