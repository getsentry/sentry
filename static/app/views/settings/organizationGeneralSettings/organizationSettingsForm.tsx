import {useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import Tag from 'sentry/components/tag';
import organizationSettingsFields from 'sentry/data/forms/organizationGeneralSettings';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const HookCodecovSettingsLink = HookOrDefault({
  hookName: 'component:codecov-integration-settings-link',
});

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

  const forms = useMemo(() => {
    const formsConfig = cloneDeep(organizationSettingsFields);
    formsConfig[0].fields = [
      ...formsConfig[0].fields,
      {
        name: 'codecovAccess',
        type: 'boolean',
        disabled: !organization.features.includes('codecov-integration'),
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
                  <Tag role="status" icon={<IconLock isSolid />}>
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
    ];
    return formsConfig;
  }, [organization]);

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
      <JsonForm {...jsonFormSettings} forms={forms} />
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
