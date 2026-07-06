import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicsProps} from '@sentry/scraps/leadingGraphics';

export interface BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> {
  onChange: (value: SelectOption<Value>) => void;
  options: Array<SelectOption<Value>>;
  value: Value;
  leadingGraphic?: React.ReactElement<LeadingGraphicsProps>;
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
