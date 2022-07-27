import {Event, KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string>;
  meta: NonNullable<Event['_meta']>['frame'];
};

export function FrameVariables({data, meta}: Props) {
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
        meta: meta?.[key]?.[''],
      });
    }
    return transformedData;
  };

  const transformedData = getTransformedData();

  return (
    <KeyValueList data={transformedData} onClick={handlePreventToggling} isContextData />
  );
}
