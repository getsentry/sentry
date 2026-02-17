import {Checkbox} from '@sentry/scraps/checkbox';
import {InlineCode} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface AlertDataAttributeProps {
  dataKey: string;
  value: unknown;
}

export function AlertDataAttribute({dataKey, value}: AlertDataAttributeProps) {
  if (value === null || value === undefined || typeof value === 'object') {
    return null;
  }

  let displayValue: React.ReactNode;

  switch (typeof value) {
    case 'boolean':
      displayValue = <Checkbox checked={value} disabled />;
      break;
    case 'string':
      displayValue = <Text monospace>{value}</Text>;
      break;
    default:
      displayValue = <InlineCode>{value.toString()}</InlineCode>;
  }

  return (
    <Flex gap="xs" align="center">
      <Text bold>{dataKey}:</Text>
      {displayValue}
    </Flex>
  );
}
