import {useState} from 'react';

import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';

export default function TimeoutInput({
  disabled,
  initialValue,
  onChange,
}: {
  disabled: boolean;
  initialValue: number;
  onChange: (value: number) => void;
}) {
  const [value, setValue] = useState<number>(initialValue);

  return (
    <Flex gap="xs" align="center" wrap="nowrap">
      <Text wrap="nowrap">
        {tct('[input] seconds', {
          input: (
            <Input
              style={{display: 'inline', width: 'auto'}}
              value={value}
              disabled={disabled}
              size="xs"
              placeholder={t('timeout in seconds')}
              onChange={e => {
                onChange(Number(e.target.value));
                setValue(Number(e.target.value));
              }}
            />
          ),
        })}
      </Text>
    </Flex>
  );
}
