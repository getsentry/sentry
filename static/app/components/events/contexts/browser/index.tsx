import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types';

import {getUnknownData} from '../getUnknownData';

import {getBrowserKnownData} from './getBrowserKnownData';
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
  const meta = event._meta?.browser ?? {};
  return (
    <Fragment>
      <ContextBlock data={getBrowserKnownData({data, meta})} />
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
