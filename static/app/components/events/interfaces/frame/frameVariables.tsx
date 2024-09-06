import {useMemo} from 'react';

import type {StructedEventDataConfig} from 'sentry/components/structuredEventData';
import StructuredEventData from 'sentry/components/structuredEventData';
import type {KeyValueListData} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';

import KeyValueList from '../keyValueList';

type Props = {
  data: Record<string, string | null | boolean | number | Record<string, string | null>>;
  meta?: Record<any, any>;
  platform?: PlatformKey;
};

const PYTHON_STRING_REGEX = /^['"](.*)['"]$/;
const NUMERIC_STRING_REGEX = /^-?\d+(\.\d+)?$/;

const renderPythonBoolean = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  return value ? 'True' : 'False';
};

const renderNodeNull = (value: unknown) => {
  if (value === '<null>') {
    return 'null';
  }

  if (value === '<undefined>') {
    return 'undefined';
  }

  return String(value);
};

const getStructuredDataConfig = ({
  platform,
}: {
  platform?: PlatformKey;
}): StructedEventDataConfig => {
  switch (platform) {
    case 'python':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'True' || value === 'False',
        isNull: value => value === null || value === 'None',
        renderBoolean: renderPythonBoolean,
        renderNull: () => 'None',
        // Python SDK wraps string values in single quotes
        isString: value => typeof value === 'string' && PYTHON_STRING_REGEX.test(value),
        // Strip single quotes from python strings for display purposes
        renderString: value => value.replace(PYTHON_STRING_REGEX, '$1'),
        // Python SDK returns numbers as strings, but we can assume they are numbers if they look like one
        isNumber: value =>
          typeof value === 'number' ||
          (typeof value === 'string' && NUMERIC_STRING_REGEX.test(value)),
      };
    case 'ruby':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'true' || value === 'false',
        isNull: value => value === null || value === 'nil',
        renderNull: () => 'nil',
      };
    case 'php':
      return {
        isBoolean: value =>
          typeof value === 'boolean' || value === 'true' || value === 'false',
        isNull: value => value === null || value === 'null',
      };
    case 'node':
      return {
        isNull: value => value === null || value === '<null>' || value === '<undefined>',
        renderNull: renderNodeNull,
      };
    default:
      return {};
  }
};

export function FrameVariables({data, meta, platform}: Props) {
  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  const handlePreventToggling = () => (event: React.MouseEvent<HTMLTableElement>) => {
    event.stopPropagation();
  };

  const transformedData: KeyValueListData = [];

  const dataKeys = Object.keys(data).reverse();

  const config = useMemo(() => getStructuredDataConfig({platform}), [platform]);

  for (const key of dataKeys) {
    transformedData.push({
      key,
      subject: key,
      value: (
        <StructuredEventData
          config={config}
          data={data[key]}
          meta={meta?.[key]}
          withAnnotatedText
        />
      ),
    });
  }

  return <KeyValueList data={transformedData} onClick={handlePreventToggling} />;
}
