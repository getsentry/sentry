import {Fragment} from 'react';
import sortBy from 'lodash/sortBy';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Input} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {fetchMutation} from 'sentry/utils/queryClient';

const PREDEFINED_RATE_LIMIT_VALUES = [
  0, 60, 300, 900, 3600, 7200, 14400, 21600, 43200, 86400,
];

const rateLimitSchema = z.object({
  rateLimit: z
    .object({
      count: z.number().int().min(0),
      window: z.number().int().min(0),
    })
    .nullable()
    .refine(value => !(value && value.window > 0 && value.count <= 0), {
      message: 'Count is required when a time window is set',
    })
    .transform(value => {
      if (!value || value.count === 0 || value.window === 0) {
        return null;
      }
      return value;
    }),
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
            <AutoSaveForm
              name="rateLimit"
              schema={rateLimitSchema}
              initialValue={data.rateLimit}
              mutationOptions={{
                mutationFn: (submitData: {rateLimit: ProjectKey['rateLimit']}) =>
                  fetchMutation<ProjectKey>({
                    url: endpoint,
                    method: 'PUT',
                    data: submitData,
                  }),
                onSuccess: updateData,
              }}
            >
              {field => {
                const value = field.state.value;
                const window = value?.window;
                const allowedValues = getAllowedRateLimitValues(window);
                const windowIndex = Math.max(0, allowedValues.indexOf(window ?? 0));
                const windowLabel =
                  !window || window === 0 ? t('None') : getExactDuration(window);
                return (
                  <field.Layout.Row
                    label={t('Rate Limit')}
                    hintText={t(
                      'Apply a rate limit to this credential to cap the amount of errors accepted during a time window.'
                    )}
                  >
                    <field.Base<HTMLInputElement> disabled={fieldDisabled}>
                      {(baseProps, {indicator}) => (
                        <Fragment>
                          <Grid
                            columns="100px max-content 1fr max-content"
                            align="center"
                            gap="xl"
                            flexGrow={1}
                          >
                            <Input
                              {...baseProps}
                              type="number"
                              min={0}
                              value={value?.count ?? ''}
                              placeholder={t('Count')}
                              onChange={event =>
                                field.handleChange({
                                  count: Number(event.target.value),
                                  window: value?.window ?? 0,
                                })
                              }
                              onBlur={() => {
                                baseProps.onBlur();
                              }}
                            />
                            <Text size="sm" align="center">
                              {t('event(s) in')}
                            </Text>
                            <Slider
                              min={0}
                              max={allowedValues.length - 1}
                              step={1}
                              value={windowIndex}
                              formatOptions="hidden"
                              disabled={fieldDisabled || baseProps.disabled}
                              aria-valuetext={windowLabel}
                              aria-label={t('Rate limit window')}
                              onChange={index =>
                                field.handleChange({
                                  count: value?.count ?? 0,
                                  window: allowedValues[index] ?? 0,
                                })
                              }
                              onChangeEnd={() => {
                                field.handleBlur();
                              }}
                            />
                            <Text size="sm" variant="muted">
                              {windowLabel}
                            </Text>
                          </Grid>
                          {indicator}
                        </Fragment>
                      )}
                    </field.Base>
                  </field.Layout.Row>
                );
              }}
            </AutoSaveForm>
          </FieldGroup>
        );
      }}
    </Feature>
  );
}
