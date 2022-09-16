import {KeyValueListData} from 'sentry/types';

import {AnnotatedText} from '../../meta/annotatedText';
import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string | null | Record<string, string | null>>;
  meta?: Record<any, any>;
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
      value: Array.isArray(data[key])
        ? (data[key] as unknown as any[]).map((v, i) => {
            if (!v && meta?.[key]?.[i]?.['']) {
              return <AnnotatedText key={key} value={v} meta={meta?.[key]?.[i]?.['']} />;
            }
            return v;
          })
        : data[key],
      meta: meta?.[key]?.[''],
    });
  }

  return (
    <KeyValueList data={transformedData} onClick={handlePreventToggling} isContextData />
  );
}
