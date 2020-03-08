import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import {fields} from 'app/data/forms/projectGeneralSettings';
import AsyncView from 'app/views/asyncView';
import ProjectActions from 'app/actions/projectActions';
import {Organization} from 'app/types';
import SentryTypes from 'app/sentryTypes';

import ProjectDataPrivacyRulesPanel from './projectDataPrivacyRulesPanel';

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
    const project = this.state.data;
    const {orgId, projectId} = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const features = new Set(organization.features);

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Data Privacy')} />
        <Form
          saveOnBlur
          allowUndo
          initialData={project}
          apiMethod="PUT"
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
        <ProjectDataPrivacyRulesPanel />
      </React.Fragment>
    );
  }
}

export default ProjectDataPrivacyContent;
