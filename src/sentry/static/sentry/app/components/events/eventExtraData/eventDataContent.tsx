import React from 'react';

import {defined} from 'app/utils';
import ContextBlock from 'app/components/events/contexts/contextBlock';

import getEventExtraDataKnownData from './getEventExtraDataKnownData';

type Props = {
  data?: {[key: string]: any};
  raw: boolean;
};

const EventDataContent = ({data, raw}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock data={getEventExtraDataKnownData(data)} raw={raw} />;
};

export default EventDataContent;
