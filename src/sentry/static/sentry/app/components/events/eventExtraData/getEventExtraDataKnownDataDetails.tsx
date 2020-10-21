import * as React from 'react';

import {t} from 'app/locale';

import {EventExtraDataType, EventExtraData} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

const getEventExtraDataKnownDataDetails = (
  data: EventExtraData,
  key: EventExtraDataType
): Output => {
  switch (key) {
    case EventExtraDataType.CRASHED_PROCESS:
      return {
        subject: t('Crashed Process'),
        value: data[key],
      };
    default:
      return {
        subject: key,
        value: data[key],
      };
  }
};

export default getEventExtraDataKnownDataDetails;
