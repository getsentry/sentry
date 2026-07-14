import {mutationOptions, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';

interface Props {
  access: Set<Scope>;
}

type FeatureFlag = {description: string; value: boolean};
type FeatureFlags = Record<string, FeatureFlag>;

const featureFlagsQueryOptions = apiOptions.as<FeatureFlags>()(
  '/internal/feature-flags/',
  {
    staleTime: 0,
  }
);

function getFeatureFlagSchema(flag: string) {
  return z.object({[flag]: z.boolean()});
}

function updateFeatureFlags(
  featureFlags: FeatureFlags,
  updatedFlags: Record<string, boolean>
): FeatureFlags {
  return Object.fromEntries(
    Object.entries(featureFlags).map(([flag, featureFlag]) => {
      const newValue = updatedFlags[flag];
      return [
        flag,
        newValue === undefined ? featureFlag : {...featureFlag, value: newValue},
      ];
    })
  );
}

export function EarlyFeaturesSettingsForm({access}: Props) {
  const queryClient = useQueryClient();
  const {data: featureFlags, isPending, isError} = useQuery(featureFlagsQueryOptions);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const disabled = !access.has('org:write');
  const featureFlagMutationOptions = mutationOptions({
    mutationFn: (data: Record<string, boolean>) =>
      fetchMutation<void>({
        method: 'PUT',
        url: '/internal/feature-flags/',
        data,
      }),
    onSuccess: (_response, updatedFlags) => {
      queryClient.setQueryData(featureFlagsQueryOptions.queryKey, prev => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          json: updateFeatureFlags(prev.json, updatedFlags),
        };
      });
    },
    onError: () => addErrorMessage(t('Unable to save change')),
  });

  return (
    <FieldGroup title={t('Early Adopter Features')}>
      {Object.entries(featureFlags ?? {}).map(([flag, {description, value}]) => (
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
