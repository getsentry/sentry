import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import AsyncComponent from 'sentry/components/asyncComponent';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import Tag from 'sentry/components/tag';
import organizationSettingsFields from 'sentry/data/forms/organizationGeneralSettings';
import {IconCodecov, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Scope} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  access: Set<Scope>;
  initialData: Organization;
  location: Location;
  onSave: (previous: Organization, updated: Organization) => void;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type State = AsyncComponent['state'] & {
  authProvider: object;
};

class OrganizationSettingsForm extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    if (organization.features.includes('codecov-stacktrace-integration')) {
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
              <ExternalLink href="https://about.codecov.io/sign-up-sentry-codecov/">
                {t('Learn More')}
              </ExternalLink>
            </PoweredByCodecov>
          ),
        },
      ];
    }

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
