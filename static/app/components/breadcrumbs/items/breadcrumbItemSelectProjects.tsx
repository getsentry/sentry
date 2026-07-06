import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

export interface BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> {
  onChange: (value: SelectOption<Value>) => void;
  options: Array<SelectOption<Value>>;
  value: Value;
  /** Optional leading graphic rendered before the select trigger (e.g. a LeadingGraphics badge). */
  leadingGraphic?: React.ReactNode;
}

export function BreadcrumbItemSelectProjects<Value extends SelectKey = string>({
  options,
  value,
  onChange,
  leadingGraphic,
}: BreadcrumbItemSelectProjectsProps<Value>) {
  return (
    <Flex as="span" align="center" gap="0" maxWidth="160px" flexShrink={0}>
      {leadingGraphic}
      <CompactSelect options={options} value={value} onChange={onChange} size="sm" />
    </Flex>
  );
}
