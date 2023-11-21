import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {JsonFormObject} from 'sentry/components/forms/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization, OrganizationAuthProvider, Scope} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import withOrganization from 'sentry/utils/withOrganization';

interface Props extends RouteComponentProps<{}, {}> {
  access: Set<Scope>;
  location: Location;
  organization: Organization;
}

interface State {
  authProvider: OrganizationAuthProvider;
  featureFlags: {[key: string]: {description: string; value: boolean}};
}

function EarlyFeaturesSettingsForm({organization, access, location}: Props) {
  const {data: authProvider, isLoading: authProviderIsLoading} = useApiQuery<
    Pick<State, 'authProvider'>
  >([`/organizations/${organization.slug}/auth-provider/`], {
    staleTime: 0,
  });

  const {data: featureFlags, isLoading: featureFlagsIsLoading} = useApiQuery<
    Pick<State, 'featureFlags'>
  >(['/internal/feature-flags/'], {
    staleTime: 0,
  });

  const endpoint = `/internal/feature-flags/`;

  if (authProviderIsLoading || featureFlagsIsLoading) {
    return <LoadingIndicator />;
  }

  const initialData = {};
  for (const flag in featureFlags) {
    if (featureFlags.hasOwnProperty(flag)) {
      const obj = featureFlags[flag];
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
        apiEndpoint={endpoint}
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

export default withOrganization(EarlyFeaturesSettingsForm);
