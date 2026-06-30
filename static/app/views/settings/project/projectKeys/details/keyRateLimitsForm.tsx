import {useMutation} from '@tanstack/react-query';
import sortBy from 'lodash/sortBy';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, FieldGroup, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const PREDEFINED_RATE_LIMIT_VALUES = [
  0, 60, 300, 900, 3600, 7200, 14400, 21600, 43200, 86400,
];

const rateLimitSchema = z
  .object({
    count: z.number().int().min(0).nullable(),
    window: z.number().int().min(0),
  })
  .refine(value => !((value.count ?? 0) > 0 && value.window === 0), {
    message: t('A time window is required when a count is set'),
    path: ['window'],
  })
  .refine(value => !(value.window > 0 && (value.count === null || value.count === 0)), {
    message: t('Count is required when a time window is set'),
    path: ['count'],
  });

interface KeyRateLimitsFormProps {
  data: ProjectKey;
  disabled: boolean;
  keyId: string;
  organization: Organization;
  project: Project;
  projectId: string;
  updateData: (data: ProjectKey) => void;
}

export function KeyRateLimitsForm({
  data,
  disabled,
  organization,
  keyId,
  projectId,
  project,
  updateData,
}: KeyRateLimitsFormProps) {
  const endpoint = `/projects/${organization.slug}/${projectId}/keys/${keyId}/`;

  function getAllowedRateLimitValues(currentRateLimit?: number) {
    const {rateLimit} = data;
    const {window} = rateLimit ?? {};

    if (defined(window)) {
      if (currentRateLimit !== window) {
        return PREDEFINED_RATE_LIMIT_VALUES;
      }

      if (!PREDEFINED_RATE_LIMIT_VALUES.includes(window)) {
        return sortBy([...PREDEFINED_RATE_LIMIT_VALUES, window]);
      }
    }

    return PREDEFINED_RATE_LIMIT_VALUES;
  }

  const mutation = useMutation({
    mutationFn: (submitData: {rateLimit: ProjectKey['rateLimit']}) =>
      fetchMutation<ProjectKey>({
        url: endpoint,
        method: 'PUT',
        data: submitData,
      }),
    onSuccess: responseData => {
      addSuccessMessage(t('Successfully saved rate limit.'));
      updateData(responseData);
      form.reset();
    },
    onError: error => {
      let message: string | undefined;
      if (error instanceof RequestError) {
        const detail = error.responseJSON?.detail;
        message = typeof detail === 'string' ? detail : detail?.message;
      }
      addErrorMessage(message ?? t('Unable to save rate limit.'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      count: data.rateLimit?.count ?? null,
      window: data.rateLimit?.window ?? 0,
    },
    validators: {onDynamic: rateLimitSchema},
    onSubmit: ({value}) => {
      const rateLimit =
        (value.count === null || value.count === 0) && value.window === 0
          ? null
          : {count: value.count ?? 0, window: value.window};
      return mutation.mutateAsync({rateLimit}).catch(() => {});
    },
  });

  const disabledAlert = ({features}: {features: string[]}) => (
    <FeatureDisabled
      alert={Alert}
      features={features}
      featureName={t('Key Rate Limits')}
    />
  );

  return (
    <Feature
      features="projects:rate-limits"
      overrideName="feature-disabled:rate-limits"
      project={project}
      renderDisabled={({children, ...props}) =>
        typeof children === 'function' &&
        children({...props, renderDisabled: disabledAlert})
      }
    >
      {({hasFeature, features, renderDisabled}) => {
        const fieldDisabled = disabled || !hasFeature;
        return (
          <form.AppForm form={form}>
            <FieldGroup title={t('Rate Limits')}>
              <Alert variant="info" system>
                {t(
                  `Rate limits provide a flexible way to manage your error
                    volume. If you have a noisy project or environment you
                    can configure a rate limit for this key to reduce the
                    number of errors processed. To manage your transaction
                    volume, we recommend adjusting your sample rate in your
                    SDK configuration.`
                )}
              </Alert>
              {!hasFeature &&
                typeof renderDisabled === 'function' &&
                renderDisabled({
                  organization,
                  project,
                  features,
                  hasFeature,
                  children: null,
                })}

              <form.AppField name="count">
                {field => (
                  <field.Layout.Row
                    label={t('Count')}
                    hintText={t(
                      'The maximum number of errors to accept in the time window.'
                    )}
                  >
                    <field.Number
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={fieldDisabled}
                      min={0}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
              <form.AppField name="window">
                {field => {
                  const windowValue = field.state.value;
                  const allowedValues = getAllowedRateLimitValues(windowValue);
                  const windowIndex = Math.max(0, allowedValues.indexOf(windowValue));
                  const windowLabel =
                    windowValue === 0 ? t('None') : getExactDuration(windowValue);
                  return (
                    <field.Layout.Row
                      label={t('Time Window')}
                      hintText={t('The time period in which the rate limit is applied.')}
                    >
                      <Stack>
                        <Text variant="muted" bold>
                          {windowLabel}
                        </Text>
                        <field.Range
                          value={windowIndex}
                          onChange={index =>
                            field.handleChange(allowedValues[index] ?? 0)
                          }
                          min={0}
                          max={allowedValues.length - 1}
                          step={1}
                          formatOptions="hidden"
                          disabled={fieldDisabled}
                          aria-valuetext={windowLabel}
                          aria-label={t('Time window')}
                        />
                      </Stack>
                    </field.Layout.Row>
                  );
                }}
              </form.AppField>
              <Flex gap="sm" justify="end">
                <form.ResetButton disabled={fieldDisabled}>{t('Reset')}</form.ResetButton>
                <form.SubmitButton disabled={fieldDisabled}>
                  {t('Save')}
                </form.SubmitButton>
              </Flex>
            </FieldGroup>
          </form.AppForm>
        );
      }}
    </Feature>
  );
}
