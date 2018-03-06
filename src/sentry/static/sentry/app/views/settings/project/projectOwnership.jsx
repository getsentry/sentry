import PropTypes from 'prop-types';
import React from 'react';
// import styled from 'react-emotion';
import {Box} from 'grid-emotion';

// import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
// import AutoSelectText from '../../../components/autoSelectText';
import Button from '../../../components/buttons/button';
// import Confirm from '../../../components/confirm';
// import Field from '../components/forms/field';
// import LoadingIndicator from '../../../components/';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
// import SentryTypes from '../../../proptypes';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
// import ExternalLink from '../../../components/externalLink';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import OwnerInput from './ownerInput';

class ProjectOwnership extends AsyncView {
  static propTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
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
    let {organization, project} = this.props;
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
              {tct(
                `To configure [csp:CSP] reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`,
                {
                  csp: <acronym title="Content Security Policy" />,
                }
              )}
            </TextBlock>
            <OwnerInput project={project} initialText={ownership.raw || ''} />
            <Button size="small" priority="primary">
              {t('Save Changes')}
            </Button>
          </PanelBody>
        </Panel>

        <Form
          apiMethod="POST"
          onFieldChange={data => {
            console.log(data);
          }}
          apiEndpoint={`/projects/${organization.id}/${project.id}/settings/`}
          onSubmit={data => {
            console.log(data);
          }}
          initialData={{fallthrough: ownership.fallthrough}}
          hideFooter
        >
          <Box>
            <JsonForm
              forms={[
                {
                  title: 'Default Ownership',
                  fields: [
                    {
                      name: 'fallthrough',
                      type: 'boolean',
                      label: 'Default Owner is everyone',
                      getData: data => ({options: data}),
                    },
                  ],
                },
              ]}
            />
          </Box>
        </Form>
      </div>
    );
  }
}

export default ProjectOwnership;
