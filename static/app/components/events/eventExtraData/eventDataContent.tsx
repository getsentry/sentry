import ContextBlock from 'app/components/events/contexts/contextBlock';
import {defined} from 'app/utils';

import getEventExtraDataKnownData from './getEventExtraDataKnownData';

type Props = {
  raw: boolean;
  data?: Record<string, any>;
};

const EventDataContent = ({data, raw}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock data={getEventExtraDataKnownData(data)} raw={raw} />;
};

export default EventDataContent;
