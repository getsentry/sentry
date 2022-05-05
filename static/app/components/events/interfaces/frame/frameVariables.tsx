import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string>;
};

const FrameVariables = ({data}: Props) => {
  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => (event: React.MouseEvent<HTMLTableElement>) => {
    event.stopPropagation();
  };

  const getTransformedData = (): KeyValueListData => {
    const transformedData: KeyValueListData = [];

    const dataKeys = Object.keys(data).reverse();
    for (const key of dataKeys) {
      transformedData.push({
        key,
        subject: key,
        value: data[key],
        meta: getMeta(data, key),
      });
    }
    return transformedData;
  };

  const transformedData = getTransformedData();

  return (
    <KeyValueList data={transformedData} onClick={handlePreventToggling} isContextData />
  );
};

export default FrameVariables;
