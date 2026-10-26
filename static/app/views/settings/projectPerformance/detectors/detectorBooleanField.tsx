import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import type {CommonDetectorFieldProps} from './detectorField';
import {useDetectorFieldMutationOptions} from './useDetectorFieldMutationOptions';

export type DetectorBooleanFieldProps = CommonDetectorFieldProps & {
  initialValue: boolean;
};

export function DetectorBooleanField({
  disabled,
  help,
  initialValue,
  label,
  name,
  projectSlug,
}: DetectorBooleanFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions({projectSlug});

  return (
    <AutoSaveForm
      name={name}
      schema={z.object({[name]: z.boolean()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => (
        <field.Layout.Row label={label} hintText={help}>
          <field.Switch
            checked={field.state.value}
            onChange={field.handleChange}
            disabled={disabled}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}
