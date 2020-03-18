import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import {fields} from 'app/data/forms/projectGeneralSettings';
import AsyncView from 'app/views/asyncView';
import ProjectActions from 'app/actions/projectActions';
import {Organization} from 'app/types';
import SentryTypes from 'app/sentryTypes';

import DataPrivacyRulesPanel from '../components/dataPrivacyRulesPanel/dataPrivacyRulesPanel';

type Props = {
  organization: Organization;
  params: {
    orgId: string;
    projectId: string;
  };
};

class ProjectDataPrivacyContent extends AsyncView<Props> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    // left the router contextType to satisfy the compiler
    router: PropTypes.object,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/`]];
  }

  renderBody() {
    const {organization} = this.context;
    const initialData = this.state.data;
    const {orgId, projectId} = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const relayPiiConfig = initialData?.relayPiiConfig;
    const apiMethod = 'PUT';

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Data Privacy')} />
        <Form
          saveOnBlur
          allowUndo
          initialData={initialData}
          apiMethod={apiMethod}
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            // This will update our project context
            ProjectActions.updateSuccess(resp);
          }}
        >
          <JsonForm
            title={t('Data Privacy')}
            additionalFieldProps={{
              organization,
            }}
            features={features}
            disabled={!access.has('project:write')}
            fields={[
              fields.dataScrubber,
              fields.dataScrubberDefaults,
              fields.scrubIPAddresses,
              fields.sensitiveFields,
              fields.safeFields,
              fields.storeCrashReports,
            ]}
          />
        </Form>
        <DataPrivacyRulesPanel
          panelHeaderSubTitle={
            <PanelHeaderSubTitle>
              {tct(
                'This can also be configured organization-wide in [linkToOrganizationSecurityAndPrivacy]',
                {
                  linkToOrganizationSecurityAndPrivacy: (
                    <Link to={`/settings/${orgId}/security-and-privacy/`}>
                      {t('Organization Security and Privacy')}
                    </Link>
                  ),
                }
              )}
            </PanelHeaderSubTitle>
          }
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
        />
      </React.Fragment>
    );
  }
}

export default ProjectDataPrivacyContent;

const PanelHeaderSubTitle = styled('div')`
  display: grid;
  grid-gap: 4px;
  grid-template-columns: auto 1fr;
`;
