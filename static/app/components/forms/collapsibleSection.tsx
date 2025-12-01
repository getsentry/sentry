import type {ReactNode} from 'react';

import type {FieldFromConfigProps} from 'sentry/components/forms/fieldFromConfig';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject} from 'sentry/components/forms/types';

export interface CollapsibleSectionProps extends Omit<FieldFromConfigProps, 'field'> {
  fields: FieldObject[];
  label: ReactNode | (() => React.ReactNode);
}

export default function CollapsibleSection(props: CollapsibleSectionProps) {
  return (
    <JsonForm
      disabled={
        typeof props.disabled === 'function' ? props.disabled(props) : props.disabled
      }
      collapsible
      initiallyCollapsed
      nested
      title={typeof props.label === 'function' ? props.label() : props.label}
      fields={props.fields}
    />
  );
}
