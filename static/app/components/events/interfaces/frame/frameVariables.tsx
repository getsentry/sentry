import {KeyValueListData} from 'sentry/types';

import {getChildMetaContainer, MetaContainer} from '../../meta/metaContainer';
import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string | null | Record<string, string | null>>;
  meta?: MetaContainer;
};

export function FrameVariables({data, meta}: Props) {
  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => (event: React.MouseEvent<HTMLTableElement>) => {
    event.stopPropagation();
  };

  const transformedData: KeyValueListData = [];

  const dataKeys = Object.keys(data).reverse();

  for (const key of dataKeys) {
    transformedData.push({
      key,
      subject: key,
      value: data[key],
      meta: getChildMetaContainer(meta, key),
    });
  }

  return (
    <KeyValueList data={transformedData} onClick={handlePreventToggling} isContextData />
  );
}
