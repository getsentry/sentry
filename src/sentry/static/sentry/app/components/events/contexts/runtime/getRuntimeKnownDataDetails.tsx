import {t} from 'app/locale';

export enum RuntimeKnownDataDetailsType {
  NAME = 'name',
  VERSION = 'version',
}

export type RuntimeData = {
  name: string;
  type: string;
  build: string;
  version?: string;
};

type Output = {
  subject: string;
  value: string | null;
};

function getRuntimeKnownDataDetails(
  data: RuntimeData,
  type: RuntimeKnownDataDetailsType
): Output | undefined {
  switch (type) {
    case RuntimeKnownDataDetailsType.NAME:
      return {
        subject: t('Name'),
        value: data.name,
      };
    case RuntimeKnownDataDetailsType.VERSION:
      return {
        subject: t('Version'),
        value: `${data.version}${data.build ? `(${data.build})` : ''}`,
      };
    default:
      return undefined;
  }
}

export default getRuntimeKnownDataDetails;
