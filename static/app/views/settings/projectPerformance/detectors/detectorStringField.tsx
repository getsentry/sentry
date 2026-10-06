import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import type {CommonDetectorFieldProps} from './detectorField';
import {useDetectorFieldMutationOptions} from './useDetectorFieldMutationOptions';

export type DetectorStringFieldProps = CommonDetectorFieldProps & {
  initialValue: string;
  placeholder?: string;
};

export function DetectorStringField({
  disabled,
  help,
  initialValue,
  label,
  name,
  placeholder,
  projectSlug,
}: DetectorStringFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions({projectSlug});

  return (
    <AutoSaveForm
      name={name}
      schema={z.object({[name]: z.string()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => (
        <field.Layout.Row label={label} hintText={help}>
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={placeholder}
            disabled={disabled}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}
