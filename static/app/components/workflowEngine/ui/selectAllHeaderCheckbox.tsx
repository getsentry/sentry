import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

type SelectAllHeaderCheckboxProps = {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  className?: string;
};

export function SelectAllHeaderCheckbox({
  checked,
  onChange,
  className,
}: SelectAllHeaderCheckboxProps) {
  return (
    <Flex
      align="center"
      flexShrink={0}
      width="20px"
      height="20px"
      className={className}
      onClick={event => {
        event.stopPropagation();
      }}
    >
      <Checkbox
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        aria-label={t('Select all on page')}
      />
    </Flex>
  );
}
