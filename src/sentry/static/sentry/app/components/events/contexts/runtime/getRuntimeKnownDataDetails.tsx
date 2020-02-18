import {t} from 'app/locale';

import {RuntimeData, RuntimeKnownDataType} from './types';

type Output = {
  subject: string;
  value?: React.ReactNode;
};

function getRuntimeKnownDataDetails(
  data: RuntimeData,
  type: RuntimeKnownDataType
): Output {
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
      return {
        subject: type,
        value: data[type],
      };
  }
}

export default getRuntimeKnownDataDetails;
