import type {ReactNode} from 'react';

import type {Field} from 'sentry/components/forms/types';

function getServerField(form: Field[] | undefined, name: string): Field | undefined {
  return form?.find(field => field.name === name);
}

export function getServerFieldLabel(form: Field[] | undefined, name: string): ReactNode {
  const label = getServerField(form, name)?.label;
  return typeof label === 'function' ? label() : label;
}

export function getServerFieldDefault(form: Field[] | undefined, name: string): string {
  const defaultValue = getServerField(form, name)?.defaultValue;
  return typeof defaultValue === 'string' ? defaultValue : '';
}
