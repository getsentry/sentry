import React from 'react';

import {t} from 'app/locale';

export enum EventExtraDataSubjectType {
  CRASHED_PROCESS = 'crashed_process',
}

type Props = {
  type: EventExtraDataSubjectType;
};

const EventExtraDataSubject = ({type}: Props) => {
  switch (type) {
    case EventExtraDataSubjectType.CRASHED_PROCESS:
      return <React.Fragment>{t('Crashed Process')}</React.Fragment>;
    default:
      return <React.Fragment>{type}</React.Fragment>;
  }
};

export default EventExtraDataSubject;
