import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  access: Set<Scope>;
}

type FeatureFlags = Record<string, {description: string; value: boolean}>;

function getFeatureFlagSchema(flag: string) {
  return z.object({[flag]: z.boolean()});
}

export function EarlyFeaturesSettingsForm({access}: Props) {
  const {data: featureFlags, isPending} = useApiQuery<FeatureFlags>(
    ['/internal/feature-flags/'],
    {staleTime: 0}
  );

  if (isPending || !featureFlags) {
    return <LoadingIndicator />;
  }

  const disabled = !access.has('org:write');
  const featureFlagMutationOptions = mutationOptions({
    mutationFn: (data: Record<string, boolean>) =>
      fetchMutation<FeatureFlags>({
        method: 'PUT',
        url: '/internal/feature-flags/',
        data,
      }),
    onError: () => addErrorMessage(t('Unable to save change')),
  });

  return (
    <FieldGroup title={t('Early Adopter Features')}>
      {Object.entries(featureFlags).map(([flag, {description, value}]) => (
        <AutoSaveForm
          key={flag}
          name={flag}
          schema={getFeatureFlagSchema(flag)}
          initialValue={value}
          mutationOptions={featureFlagMutationOptions}
        >
          {field => (
            <field.Layout.Row label={description}>
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={disabled}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      ))}
    </FieldGroup>
  );
}
