import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function ViewedCheckbox({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  'aria-label': string;
  checked: boolean | 'indeterminate';
  onChange: () => void;
}) {
  return (
    <Flex
      as="label"
      align="center"
      gap="xs"
      marginBottom="0"
      onDoubleClick={e => e.stopPropagation()}
    >
      <Checkbox size="xs" checked={checked} onChange={onChange} aria-label={ariaLabel} />
      <Text size="sm" bold={false}>
        {t('Viewed')}
      </Text>
    </Flex>
  );
}
