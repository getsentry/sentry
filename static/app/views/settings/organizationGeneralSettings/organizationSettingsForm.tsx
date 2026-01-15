import {useMemo} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {createOrganizationGeneralSettingsForm} from 'sentry/data/forms/organizationGeneralSettings';
import organizationMembershipSettingsFields from 'sentry/data/forms/organizationMembershipSettings';
import type {MembershipSettingsProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const HookOrganizationMembershipSettings = HookOrDefault({
  hookName: 'component:organization-membership-settings',
  defaultComponent: defaultMembershipSettings,
});

function defaultMembershipSettings({jsonFormSettings, forms}: MembershipSettingsProps) {
  return <JsonForm {...jsonFormSettings} forms={forms} />;
}

interface Props {
  initialData: Organization;
  onSave: (previous: Organization, updated: Organization) => void;
}

function OrganizationSettingsForm({initialData, onSave}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const endpoint = `/organizations/${organization.slug}/`;

  const access = useMemo(() => new Set(organization.access), [organization]);

  const jsonFormSettings = useMemo(
    () => ({
      features: new Set(organization.features),
      access,
      location,
      disabled: !access.has('org:write'),
    }),
    [access, location, organization.features]
  );

  const generalForms = useMemo(
    () =>
      createOrganizationGeneralSettingsForm({
        organization,
        access,
      }),
    [access, organization]
  );

  return (
    <Form
      data-test-id="organization-settings"
      apiMethod="PUT"
      apiEndpoint={endpoint}
      saveOnBlur
      allowUndo
      initialData={initialData}
      onSubmitSuccess={(updated, _model) => {
        // Special case for slug, need to forward to new slug
        if (typeof onSave === 'function') {
          onSave(initialData, updated);
        }
      }}
      onSubmitError={() => addErrorMessage('Unable to save change')}
    >
      <JsonForm {...jsonFormSettings} forms={generalForms} />
      <HookOrganizationMembershipSettings
        jsonFormSettings={jsonFormSettings}
        forms={organizationMembershipSettingsFields}
      />
      <AvatarChooser
        type="organization"
        supportedTypes={['upload', 'letter_avatar']}
        endpoint={`${endpoint}avatar/`}
        model={initialData}
        onSave={updateOrganization}
        disabled={!access.has('org:write')}
      />
    </Form>
  );
}

export default OrganizationSettingsForm;
