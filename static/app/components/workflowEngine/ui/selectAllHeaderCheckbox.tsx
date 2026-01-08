import {Flex} from '@sentry/scraps/layout';

import {Checkbox} from 'sentry/components/core/checkbox';
import {t} from 'sentry/locale';

type SelectAllHeaderCheckboxProps = {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
};

export function SelectAllHeaderCheckbox({
  checked,
  onChange,
  disabled,
  className,
}: SelectAllHeaderCheckboxProps) {
  return (
    <Flex
      align="center"
      flexShrink="0"
      width="20px"
      height="20px"
      className={className}
      onClick={event => {
        event.stopPropagation();
      }}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        aria-label={t('Select all on page')}
      />
    </Flex>
  );
}
