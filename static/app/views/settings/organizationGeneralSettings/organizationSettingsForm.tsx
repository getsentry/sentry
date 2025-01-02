import {useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AvatarChooser from 'sentry/components/avatarChooser';
import Tag from 'sentry/components/badge/tag';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import organizationGeneralSettingsFields from 'sentry/data/forms/organizationGeneralSettings';
import organizationMembershipSettingsFields from 'sentry/data/forms/organizationMembershipSettings';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MembershipSettingsProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeHideAiFeaturesField} from 'sentry/views/settings/organizationGeneralSettings/aiFeatureSettings';

const HookCodecovSettingsLink = HookOrDefault({
  hookName: 'component:codecov-integration-settings-link',
});

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
    [access, location, organization]
  );

  const generalForms = useMemo(() => {
    const formsConfig = cloneDeep(organizationGeneralSettingsFields);
    const organizationIdField: FieldObject = {
      name: 'organizationId',
      type: 'string',
      disabled: true,
      label: t('Organization ID'),
      setValue(_, _name) {
        return organization.id;
      },
      help: `The unique identifier for this organization. It cannot be modified.`,
    };

    formsConfig[0]!.fields = [
      ...formsConfig[0]!.fields.slice(0, 2),
      organizationIdField,
      ...formsConfig[0]!.fields.slice(2),
      makeHideAiFeaturesField(organization),
      {
        name: 'codecovAccess',
        type: 'boolean',
        disabled:
          !organization.features.includes('codecov-integration') ||
          !access.has('org:write'),
        label: (
          <PoweredByCodecov>
            {t('Enable Code Coverage Insights')}{' '}
            <Feature
              hookName="feature-disabled:codecov-integration-setting"
              renderDisabled={p => (
                <Hovercard
                  body={
                    <FeatureDisabled
                      features={p.features}
                      hideHelpToggle
                      featureName={t('Codecov Coverage')}
                    />
                  }
                >
                  <Tag role="status" icon={<IconLock locked />}>
                    {t('disabled')}
                  </Tag>
                </Hovercard>
              )}
              features="organizations:codecov-integration"
            >
              {() => null}
            </Feature>
          </PoweredByCodecov>
        ),
        formatMessageValue: (value: boolean) => {
          const onOff = value ? t('on') : t('off');
          return t('Codecov access was turned %s', onOff);
        },
        help: (
          <PoweredByCodecov>
            {t('powered by')} <IconCodecov /> Codecov{' '}
            <HookCodecovSettingsLink organization={organization} />
          </PoweredByCodecov>
        ),
      },
      ...(organization.features.includes('sentry-rollback-settings')
        ? [
            {
              name: 'rollbackEnabled',
              type: 'boolean',
              label: t('2024 Sentry Rollback'),
              help: t('Allow organization members to view their year in review'),
            } as FieldObject,
          ]
        : []),
    ];
    return formsConfig;
  }, [access, organization]);

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
        allowGravatar={false}
        endpoint={`${endpoint}avatar/`}
        model={initialData}
        uploadDomain={initialData.links.regionUrl}
        onSave={updateOrganization}
        disabled={!access.has('org:write')}
      />
    </Form>
  );
}

export default OrganizationSettingsForm;

const PoweredByCodecov = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  & > span {
    display: flex;
    align-items: center;
  }
`;
