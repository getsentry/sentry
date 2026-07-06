import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

export interface BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> {
  onChange: (value: SelectOption<Value>) => void;
  options: Array<SelectOption<Value>>;
  value: Value;
}

export function BreadcrumbItemSelectProjects<Value extends SelectKey = string>({
  options,
  value,
  onChange,
}: BreadcrumbItemSelectProjectsProps<Value>) {
  return (
    <Flex as="span" align="center" flexShrink={0}>
      <CompactSelect options={options} value={value} onChange={onChange} size="sm" />
    </Flex>
  );
}
