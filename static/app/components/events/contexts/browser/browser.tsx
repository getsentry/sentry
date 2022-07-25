import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';

import {getUnknownData} from '../getUnknownData';

import getBrowserKnownData from './getBrowserKnownData';
import {BrowserKnownData, BrowserKnownDataType} from './types';

type Props = {
  data: BrowserKnownData;
};

const browserKnownDataValues = [BrowserKnownDataType.NAME, BrowserKnownDataType.VERSION];

function Browser({data}: Props) {
  return (
    <Fragment>
      <ContextBlock data={getBrowserKnownData(data, browserKnownDataValues)} />
      <ContextBlock
        data={getUnknownData({allData: data, knownKeys: [...browserKnownDataValues]})}
      />
    </Fragment>
  );
}

export default Browser;
