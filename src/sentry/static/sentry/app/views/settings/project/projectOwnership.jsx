import React from 'react';

import {t} from '../../../locale';
import AsyncView from '../../asyncView';

import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import SentryTypes from '../../../proptypes';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import OwnerInput from './ownerInput';

class ProjectOwnership extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getTitle() {
    return 'Ownership';
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['project', `/projects/${orgId}/${projectId}/`],
      ['ownership', `/projects/${orgId}/${projectId}/ownership/`],
    ];
  }

  renderBody() {
    let {project, organization} = this.props;
    let {ownership} = this.state;

    return (
      <div>
        <SettingsPageHeader title={t('Issue Ownership')} />

        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>

        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>
          <PanelBody disablePadding={false}>
            <TextBlock>
              {t(
                "To configure automated issue ownership in Sentry, you'll need to define rules here."
              )}
            </TextBlock>
            <OwnerInput {...this.props} initialText={ownership.raw || ''} />
          </PanelBody>
        </Panel>

        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{fallthrough: ownership.fallthrough}}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: 'Default Ownership',
                fields: [
                  {
                    name: 'fallthrough',
                    type: 'boolean',
                    label: 'Default Owner is everyone',
                  },
                ],
              },
            ]}
          />
        </Form>
      </div>
    );
  }
}

export default ProjectOwnership;
