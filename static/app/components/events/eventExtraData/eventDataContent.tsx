import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlock';
import {defined} from 'app/utils';

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
