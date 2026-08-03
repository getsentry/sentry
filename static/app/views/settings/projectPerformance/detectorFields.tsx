import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getPerformanceIssueSettingsQueryOptions,
  type DetectorFieldConfig,
  type ProjectPerformanceSettings,
  type ProjectPerformanceSettingValue,
} from './detectorSettings';

function useDetectorFieldMutationOptions(endpoint: string, projectSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return {
    mutationFn: (data: ProjectPerformanceSettings) =>
      fetchMutation<ProjectPerformanceSettings>({url: endpoint, method: 'PUT', data}),
    onSuccess: (
      _data: ProjectPerformanceSettings,
      variables: ProjectPerformanceSettings
    ) => {
      queryClient.setQueryData(
        getPerformanceIssueSettingsQueryOptions(organization.slug, projectSlug).queryKey,
        previous =>
          previous
            ? {json: {...previous.json, ...variables}, headers: previous.headers}
            : previous
      );

      const [thresholdKey, thresholdValue] = Object.entries(variables)[0] ?? [];
      if (thresholdKey && typeof thresholdValue === 'number') {
        trackAnalytics('performance_views.project_issue_detection_threshold_changed', {
          organization,
          project_slug: projectSlug,
          threshold_key: thresholdKey,
          threshold_value: thresholdValue,
        });
      }
    },
  };
}

type DetectorFieldProps<TValue> = {
  disabled: boolean | string;
  field: DetectorFieldConfig;
  initialValue: TValue;
  mutationOptions: ReturnType<typeof useDetectorFieldMutationOptions>;
};

function DetectorBooleanField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<boolean>) {
  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.boolean()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => (
        <formField.Layout.Row label={field.label} hintText={field.help}>
          <formField.Switch
            checked={formField.state.value}
            onChange={formField.handleChange}
            disabled={disabled}
          />
        </formField.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

function DetectorStringField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<string>) {
  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.string()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => (
        <formField.Layout.Row label={field.label} hintText={field.help}>
          <formField.Input
            value={formField.state.value}
            onChange={formField.handleChange}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </formField.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

/**
 * The slider is indexed against `allowedValues` rather than bound to the raw
 * threshold, so only the sanctioned steps are reachable.
 */
function DetectorRangeField({
  disabled,
  field,
  initialValue,
  mutationOptions,
}: DetectorFieldProps<number>) {
  const allowedValues = field.allowedValues ?? [];

  return (
    <AutoSaveForm
      name={field.name}
      schema={z.object({[field.name]: z.number()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {formField => {
        const valueIndex = Math.max(allowedValues.indexOf(formField.state.value), 0);
        const formattedValue = field.formatLabel?.(formField.state.value);

        return (
          <formField.Layout.Row label={field.label} hintText={field.help}>
            <Stack flexGrow={1} gap="xs">
              <formField.Range
                aria-label={field.label}
                value={valueIndex}
                onChange={index => {
                  const value = allowedValues[index];
                  if (value !== undefined) {
                    formField.handleChange(value);
                  }
                }}
                min={0}
                max={Math.max(allowedValues.length - 1, 0)}
                step={1}
                ticks={
                  field.tickValues
                    ? {values: field.tickValues, labels: field.showTickLabels}
                    : undefined
                }
                formatOptions="hidden"
                aria-valuetext={
                  typeof formattedValue === 'string' ? formattedValue : undefined
                }
                disabled={disabled}
              />
              <Text align="right" size="sm" variant="muted">
                {formattedValue ?? formField.state.value}
              </Text>
            </Stack>
          </formField.Layout.Row>
        );
      }}
    </AutoSaveForm>
  );
}

export function DetectorAutoSaveField({
  endpoint,
  field,
  initialValue,
  projectSlug,
}: {
  endpoint: string;
  field: DetectorFieldConfig;
  initialValue: ProjectPerformanceSettingValue;
  projectSlug: string;
}) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);

  if (field.visible === false) {
    return null;
  }

  const disabled = field.disabled ? (field.disabledReason ?? true) : false;

  if (field.type === 'boolean') {
    return (
      <DetectorBooleanField
        field={field}
        initialValue={Boolean(initialValue)}
        disabled={disabled}
        mutationOptions={mutationOptions}
      />
    );
  }

  if (field.type === 'string') {
    return (
      <DetectorStringField
        field={field}
        initialValue={typeof initialValue === 'string' ? initialValue : ''}
        disabled={disabled}
        mutationOptions={mutationOptions}
      />
    );
  }

  return (
    <DetectorRangeField
      field={field}
      initialValue={
        typeof initialValue === 'number' ? initialValue : Number(field.defaultValue)
      }
      disabled={disabled}
      mutationOptions={mutationOptions}
    />
  );
}
