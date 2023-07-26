import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AvatarChooser from 'sentry/components/avatarChooser';
import DeprecatedAsyncComponent, {
  AsyncComponentState,
} from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import Tag from 'sentry/components/tag';
import organizationSettingsFields from 'sentry/data/forms/organizationGeneralSettings';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, OrganizationAuthProvider, Scope} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

const HookCodecovSettingsLink = HookOrDefault({
  hookName: 'component:codecov-integration-settings-link',
});

interface Props extends RouteComponentProps<{}, {}> {
  access: Set<Scope>;
  initialData: Organization;
  location: Location;
  onSave: (previous: Organization, updated: Organization) => void;
  organization: Organization;
}

interface State extends AsyncComponentState {
  authProvider: OrganizationAuthProvider;
}

class OrganizationSettingsForm extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['authProvider', `/organizations/${organization.slug}/auth-provider/`]];
  }

  render() {
    const {initialData, organization, onSave, access} = this.props;
    const {authProvider} = this.state;
    const endpoint = `/organizations/${organization.slug}/`;

    const jsonFormSettings = {
      additionalFieldProps: {hasSsoEnabled: !!authProvider},
      features: new Set(organization.features),
      access,
      location: this.props.location,
      disabled: !access.has('org:write'),
    };

    const forms = cloneDeep(organizationSettingsFields);
    forms[0].fields = [
      ...forms[0].fields,
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
              features={['organizations:codecov-integration']}
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
          onSave={updateOrganization}
          disabled={!access.has('org:write')}
        />
      </Form>
    );
  }
}

export default withOrganization(OrganizationSettingsForm);

const PoweredByCodecov = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  & > span {
    display: flex;
    align-items: center;
  }
`;
