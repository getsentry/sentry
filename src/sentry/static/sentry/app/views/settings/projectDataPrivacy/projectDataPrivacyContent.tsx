import React from 'react';
import PropTypes from 'prop-types';

import Link from 'app/components/links/link';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Form from 'app/views/settings/components/forms/form';
import {fields} from 'app/data/forms/projectGeneralSettings';
import AsyncView from 'app/views/asyncView';
import ProjectActions from 'app/actions/projectActions';
import SentryTypes from 'app/sentryTypes';

import DataPrivacyRulesPanel from '../components/dataPrivacyRulesPanel/dataPrivacyRulesPanel';

class ProjectDataPrivacyContent extends AsyncView<{}> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    // left the router contextType to satisfy the compiler
    router: PropTypes.object,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.context;
    return [['data', `/projects/${organization.slug}/${project.slug}/`]];
  }

  renderBody() {
    const {organization, project} = this.context;
    const initialData = this.state.data;
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
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
          additionalContext={
            <span>
              {tct(
                'These rules can be configured at the organization level in [linkToOrganizationSecurityAndPrivacy].',
                {
                  linkToOrganizationSecurityAndPrivacy: (
                    <Link to={`/settings/${organization.slug}/security-and-privacy/`}>
                      {t('Security and Privacy')}
                    </Link>
                  ),
                }
              )}
            </span>
          }
          endpoint={endpoint}
          relayPiiConfig={relayPiiConfig}
          disabled={!access.has('project:write')}
        />
      </React.Fragment>
    );
  }
}

export default ProjectDataPrivacyContent;
