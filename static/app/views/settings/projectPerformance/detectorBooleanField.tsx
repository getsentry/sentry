import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';

import {
  type CommonDetectorFieldProps,
  useDetectorFieldMutationOptions,
} from './detectorField';

export type DetectorBooleanFieldProps = Omit<CommonDetectorFieldProps, 'initialValue'> & {
  initialValue: boolean;
};

export function DetectorBooleanField({
  disabled,
  endpoint,
  help,
  initialValue,
  label,
  name,
  projectSlug,
}: DetectorBooleanFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);

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
