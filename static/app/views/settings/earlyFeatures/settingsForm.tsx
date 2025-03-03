import {Fragment} from 'react';
import type {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {JsonFormObject} from 'sentry/components/forms/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {OrganizationAuthProvider} from 'sentry/types/auth';
import type {Scope} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends RouteComponentProps {
  access: Set<Scope>;
  location: Location;
}

type FeatureFlags = Record<string, {description: string; value: boolean}>;

export default function EarlyFeaturesSettingsForm({access, location}: Props) {
  const organization = useOrganization();

  const {data: authProvider, isPending: authProviderIsLoading} =
    useApiQuery<OrganizationAuthProvider>(
      [`/organizations/${organization.slug}/auth-provider/`],
      {staleTime: 0}
    );

  const {data: featureFlags, isPending: featureFlagsIsLoading} =
    useApiQuery<FeatureFlags>(['/internal/feature-flags/'], {staleTime: 0});

  if (authProviderIsLoading || featureFlagsIsLoading) {
    return <LoadingIndicator />;
  }

  const initialData: Record<string, boolean> = {};
  for (const flag in featureFlags) {
    if (featureFlags.hasOwnProperty(flag)) {
      const obj = featureFlags[flag]!;
      initialData[flag] = obj.value;
    }
  }

  const jsonFormSettings = {
    additionalFieldProps: {hasSsoEnabled: !!authProvider},
    features: new Set(organization.features),
    access,
    location,
    disabled: !access.has('org:write'),
  };

  const featuresForm: JsonFormObject = {
    title: t('Early Adopter Features'),
    fields: Object.entries(featureFlags || {}).map(([flag, obj]) => ({
      label: obj.description,
      name: flag,
      type: 'boolean',
    })),
  };

  return (
    <Fragment>
      <Form
        data-test-id="organization-settings"
        apiMethod="PUT"
        apiEndpoint={`/internal/feature-flags/`}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitError={() => addErrorMessage('Unable to save change')}
        onSubmitSuccess={() => {}}
      >
        <JsonForm {...jsonFormSettings} forms={[featuresForm]} />
      </Form>
    </Fragment>
  );
}
