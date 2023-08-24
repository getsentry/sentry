import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {getChildMetaContainer} from 'sentry/components/events/meta/metaContainer';
import {Event} from 'sentry/types';

import {getKnownData, getUnknownData} from '../utils';

import {getBrowserKnownDataDetails} from './getBrowserKnownDataDetails';
import {BrowserKnownData, BrowserKnownDataType} from './types';

type Props = {
  data: BrowserKnownData;
  event: Event;
};

export const browserKnownDataValues = [
  BrowserKnownDataType.NAME,
  BrowserKnownDataType.VERSION,
];

export function BrowserEventContext({data, event}: Props) {
  const meta = getChildMetaContainer(event._meta, 'contexts', 'browser');
  return (
    <Fragment>
      <ContextBlock
        data={getKnownData<BrowserKnownData, BrowserKnownDataType>({
          data,
          meta,
          knownDataTypes: browserKnownDataValues,
          onGetKnownDataDetails: v => getBrowserKnownDataDetails(v),
        })}
      />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...browserKnownDataValues],
          meta,
        })}
      />
    </Fragment>
  );
}
