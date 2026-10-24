import {Checkbox} from '@sentry/scraps/checkbox';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

export const TOGGLE_VIEWED_HOTKEY = 'v';

export function ViewedCheckbox({
  checked,
  onChange,
  showHotkey = false,
  'aria-label': ariaLabel,
}: {
  'aria-label': string;
  checked: boolean | 'indeterminate';
  onChange: () => void;
  showHotkey?: boolean;
}) {
  return (
    <Tooltip
      disabled={!showHotkey}
      skipWrapper
      title={
        <Flex align="center" gap="sm">
          {checked === true ? t('Mark as not viewed') : t('Mark as viewed')}
          <Hotkey value={TOGGLE_VIEWED_HOTKEY} />
        </Flex>
      }
    >
      <Flex
        as="label"
        align="center"
        gap="xs"
        marginBottom="0"
        onDoubleClick={e => e.stopPropagation()}
      >
        <Checkbox
          size="xs"
          checked={checked}
          onChange={onChange}
          aria-label={ariaLabel}
        />
        <Text size="sm" bold={false}>
          {t('Viewed')}
        </Text>
      </Flex>
    </Tooltip>
  );
}
