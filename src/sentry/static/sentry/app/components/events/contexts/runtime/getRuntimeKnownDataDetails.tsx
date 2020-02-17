import {t} from 'app/locale';

import {RuntimeData, RuntimeKnownDataType} from './types';

type Output = {
  subject: string;
  value: string | null;
};

function getRuntimeKnownDataDetails(
  data: RuntimeData,
  type: RuntimeKnownDataType
): Output | undefined {
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

export default getRuntimeKnownDataDetails;
