import {Fragment} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';

import {getUnknownData} from '../getUnknownData';

import getRuntimeKnownData from './getRuntimeKnownData';
import {RuntimeData, RuntimeIgnoredDataType, RuntimeKnownDataType} from './types';

type Props = {
  data: RuntimeData;
};

const runtimeKnownDataValues = [RuntimeKnownDataType.NAME, RuntimeKnownDataType.VERSION];

const runtimeIgnoredDataValues = [RuntimeIgnoredDataType.BUILD];

function Runtime({data}: Props) {
  return (
    <Fragment>
      <ContextBlock data={getRuntimeKnownData(data, runtimeKnownDataValues)} />
      <ContextBlock
        data={getUnknownData({
          allData: data,
          knownKeys: [...runtimeKnownDataValues, ...runtimeIgnoredDataValues],
        })}
      />
    </Fragment>
  );
}

export default Runtime;
