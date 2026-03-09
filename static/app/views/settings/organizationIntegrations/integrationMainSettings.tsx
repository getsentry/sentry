import {useState} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

type Props = {
  integration: Integration;
  onUpdate: () => void;
  organization: Organization;
};

function IntegrationMainSettings({
  integration: integrationInitial,
  organization,
  onUpdate,
}: Props) {
  const [integration, setIntegration] = useState(integrationInitial);

  return (
    <Form
      initialData={{
        name: integration.name,
        domain: integration.domainName || '',
      }}
      apiMethod="PUT"
      apiEndpoint={`/organizations/${organization.slug}/integrations/${integration.id}/`}
      onSubmitSuccess={data => {
        addSuccessMessage(t('Integration updated.'));
        onUpdate();
        setIntegration(data);
      }}
      submitLabel={t('Save Settings')}
    >
      <JsonForm
        fields={[
          {
            name: 'name',
            type: 'string',
            required: false,
            label: t('Integration Name'),
          },
          {
            name: 'domain',
            type: 'string',
            required: false,
            label: t('Full URL'),
          },
        ]}
      />
    </Form>
  );
}

export default IntegrationMainSettings;
