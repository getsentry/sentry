import ContextData from 'sentry/components/contextData';
import type {KeyValueListData, PlatformKey} from 'sentry/types';

import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string | null | Record<string, string | null>>;
  meta?: Record<any, any>;
  platform?: PlatformKey;
};

export function FrameVariables({data, meta, platform}: Props) {
  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => (event: React.MouseEvent<HTMLTableElement>) => {
    event.stopPropagation();
  };

  const transformedData: KeyValueListData = Object.keys(data)
    .reverse()
    .map(key => ({
      key,
      subject: key,
      value: (
        <ContextData
          syntax={platform}
          data={data[key]}
          meta={meta?.[key]}
          withAnnotatedText
        />
      ),
      meta: meta?.[key]?.[''],
    }));

  return <KeyValueList data={transformedData} onClick={handlePreventToggling} />;
}
