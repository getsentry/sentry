import {useMemo} from 'react';
import {useMutation} from '@tanstack/react-query';
import sortBy from 'lodash/sortBy';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Input} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {RangeSlider} from 'sentry/components/forms/controls/rangeSlider';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t, tct, tn} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const PREDEFINED_RATE_LIMIT_VALUES = [
  0, 60, 300, 900, 3600, 7200, 14400, 21600, 43200, 86400,
];

const rateLimitSchema = z.object({
  rateLimit: z
    .object({
      count: z.number().int().min(0),
      window: z.number().int().min(0),
    })
    .nullable(),
});

type FormValues = z.input<typeof rateLimitSchema>;

function formatRateLimit(rateLimit: ProjectKey['rateLimit']) {
  const count = rateLimit?.count ?? 0;
  const window = rateLimit?.window ?? 0;
  return tct('[errors] in [timeWindow]', {
    errors: tn('%s error', '%s errors', count),
    timeWindow: window === 0 ? t('no time window') : getExactDuration(window),
  });
}

function normalizeRateLimit(rateLimit: FormValues['rateLimit']): ProjectKey['rateLimit'] {
  if (!rateLimit || rateLimit.count === 0 || rateLimit.window === 0) {
    return null;
  }

  return rateLimit;
}

interface KeyRateLimitsFormProps extends Pick<
  RouteComponentProps<{
    keyId: string;
    projectId: string;
  }>,
  'params'
> {
  data: ProjectKey;
  disabled: boolean;
  organization: Organization;
  project: Project;
  updateData: (data: ProjectKey) => void;
}

export function KeyRateLimitsForm({
  data,
  disabled,
  organization,
  params,
  project,
  updateData,
}: KeyRateLimitsFormProps) {
  const initialRateLimit = useMemo(
    () => normalizeRateLimit(data.rateLimit),
    [data.rateLimit]
  );

  const {keyId, projectId} = params;
  const endpoint = `/projects/${organization.slug}/${projectId}/keys/${keyId}/`;

  const mutation = useMutation({
    mutationFn: (rateLimit: FormValues['rateLimit']) =>
      fetchMutation<ProjectKey>({
        url: endpoint,
        method: 'PUT',
        data: {rateLimit},
      }),
    onSuccess: updated => {
      addSuccessMessage(
        tct('Changed [fieldName] from [oldValue] to [newValue]', {
          fieldName: <Text bold>{t('Rate Limit')}</Text>,
          oldValue: <Text italic>{formatRateLimit(data.rateLimit)}</Text>,
          newValue: <Text italic>{formatRateLimit(updated.rateLimit)}</Text>,
        })
      );
      updateData(updated);
    },
    onError: (error: unknown) => {
      let message: string | undefined;
      if (error instanceof RequestError) {
        const detail = error.responseJSON?.detail;
        message = typeof detail === 'string' ? detail : detail?.message;
      }
      addErrorMessage(message ?? t('Unable to save rate limit.'));
    },
  });

  const defaultValues: FormValues = {rateLimit: initialRateLimit};
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: rateLimitSchema},
    onSubmit: async ({value, formApi}) => {
      try {
        const updated = await mutation.mutateAsync(normalizeRateLimit(value.rateLimit));
        formApi.reset({rateLimit: normalizeRateLimit(updated.rateLimit)});
      } catch {
        return;
      }
    },
  });

  function getAllowedRateLimitValues(currentRateLimit?: number) {
    const {rateLimit} = data;
    const {window} = rateLimit ?? {};

    // The slider should display other values if they are set via the API, but still offer to select only the predefined values
    if (defined(window)) {
      // If the API returns a value not found in the predefined values and the user selects another value through the UI,
      // he will no longer be able to reselect the "custom" value in the slider
      if (currentRateLimit !== window) {
        return PREDEFINED_RATE_LIMIT_VALUES;
      }

      // If the API returns a value not found in the predefined values, that value will be added to the slider
      if (!PREDEFINED_RATE_LIMIT_VALUES.includes(window)) {
        return sortBy([...PREDEFINED_RATE_LIMIT_VALUES, window]);
      }
    }

    return PREDEFINED_RATE_LIMIT_VALUES;
  }

  function hasRateLimitChanged(currentRateLimit: FormValues['rateLimit']) {
    const normalizedRateLimit = normalizeRateLimit(currentRateLimit);

    return (
      initialRateLimit?.count !== normalizedRateLimit?.count ||
      initialRateLimit?.window !== normalizedRateLimit?.window
    );
  }

  const disabledAlert = ({features}: {features: string[]}) => (
    <FeatureDisabled
      alert={PanelAlert}
      features={features}
      featureName={t('Key Rate Limits')}
    />
  );

  return (
    <form.AppForm form={form}>
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
            <Panel>
              <PanelHeader>{t('Rate Limits')}</PanelHeader>

              <PanelBody>
                <PanelAlert variant="info">
                  {t(
                    `Rate limits provide a flexible way to manage your error
                      volume. If you have a noisy project or environment you
                      can configure a rate limit for this key to reduce the
                      number of errors processed. To manage your transaction
                      volume, we recommend adjusting your sample rate in your
                      SDK configuration.`
                  )}
                </PanelAlert>
                {!hasFeature &&
                  typeof renderDisabled === 'function' &&
                  renderDisabled({
                    organization,
                    project,
                    features,
                    hasFeature,
                    children: null,
                  })}
                <form.AppField name="rateLimit">
                  {field => {
                    const value = field.state.value;
                    const window = value?.window;
                    const saveIfChanged = () => {
                      if (hasRateLimitChanged(field.state.value)) {
                        void form.handleSubmit();
                      }
                    };
                    return (
                      <field.Layout.Row
                        label={t('Rate Limit')}
                        hintText={t(
                          'Apply a rate limit to this credential to cap the amount of errors accepted during a time window.'
                        )}
                        padding="xl"
                      >
                        <Grid columns="100px max-content 1fr" align="center" gap="xl">
                          <Input
                            type="number"
                            name="rateLimit.count"
                            min={0}
                            value={value?.count ?? ''}
                            placeholder={t('Count')}
                            disabled={fieldDisabled}
                            onChange={event =>
                              field.handleChange({
                                count: Number(event.target.value),
                                window: value?.window ?? 0,
                              })
                            }
                            onBlur={saveIfChanged}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                saveIfChanged();
                              }
                            }}
                          />
                          <Text size="sm" align="center">
                            {t('event(s) in')}
                          </Text>
                          <RangeSlider
                            name="rateLimit.window"
                            allowedValues={getAllowedRateLimitValues(window)}
                            value={window ?? ''}
                            placeholder={t('Window')}
                            formatLabel={rangeValue => {
                              if (typeof rangeValue === 'number') {
                                if (rangeValue === 0) {
                                  return t('None');
                                }
                                return getExactDuration(rangeValue);
                              }
                              return;
                            }}
                            disabled={fieldDisabled}
                            onChange={rangeValue =>
                              field.handleChange({
                                count: value?.count ?? 0,
                                window: Number(rangeValue),
                              })
                            }
                            onChangeEnd={saveIfChanged}
                          />
                        </Grid>
                      </field.Layout.Row>
                    );
                  }}
                </form.AppField>
              </PanelBody>
            </Panel>
          );
        }}
      </Feature>
    </form.AppForm>
  );
}
