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
  type DetectorConfigAdmin,
  type DetectorConfigCustomer,
  type ProjectPerformanceSettings,
} from './detectorSettings';

type DetectorFieldName = DetectorConfigAdmin | DetectorConfigCustomer;

type CommonDetectorFieldProps = {
  disabled: boolean | string;
  endpoint: string;
  initialValue: boolean | number | string;
  label: string;
  name: DetectorFieldName;
  projectSlug: string;
  help?: string;
};

export type DetectorBooleanFieldProps = Omit<CommonDetectorFieldProps, 'initialValue'> & {
  initialValue: boolean;
};

export type DetectorStringFieldProps = Omit<CommonDetectorFieldProps, 'initialValue'> & {
  initialValue: string;
  placeholder?: string;
};

export type DetectorRangeFieldProps = Omit<CommonDetectorFieldProps, 'initialValue'> & {
  allowedValues: readonly number[];
  initialValue: number;
  formatLabel?: (value: number | '') => React.ReactNode;
  showTickLabels?: boolean;
  tickValues?: number[];
};

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

export function DetectorStringField({
  disabled,
  endpoint,
  help,
  initialValue,
  label,
  name,
  placeholder,
  projectSlug,
}: DetectorStringFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);
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

export function DetectorRangeField({
  allowedValues,
  disabled,
  endpoint,
  formatLabel,
  help,
  initialValue,
  label,
  name,
  projectSlug,
  showTickLabels,
  tickValues,
}: DetectorRangeFieldProps) {
  const mutationOptions = useDetectorFieldMutationOptions(endpoint, projectSlug);
  return (
    <AutoSaveForm
      name={name}
      schema={z.object({[name]: z.number()})}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    >
      {field => {
        const valueIndex = Math.max(allowedValues.indexOf(field.state.value), 0);
        const formattedValue = formatLabel?.(field.state.value);

        return (
          <field.Layout.Row label={label} hintText={help}>
            <Stack flexGrow={1} gap="xs">
              <field.Range
                aria-label={label}
                value={valueIndex}
                onChange={index => {
                  const value = allowedValues[index];
                  if (value !== undefined) {
                    field.handleChange(value);
                  }
                }}
                min={0}
                max={Math.max(allowedValues.length - 1, 0)}
                step={1}
                ticks={
                  tickValues ? {values: tickValues, labels: showTickLabels} : undefined
                }
                formatOptions="hidden"
                aria-valuetext={
                  typeof formattedValue === 'string' ? formattedValue : undefined
                }
                disabled={disabled}
              />
              <Text align="right" size="sm" variant="muted">
                {formattedValue ?? field.state.value}
              </Text>
            </Stack>
          </field.Layout.Row>
        );
      }}
    </AutoSaveForm>
  );
}
