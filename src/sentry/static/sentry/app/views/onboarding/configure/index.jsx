import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import {analytics, amplitude} from 'app/utils/analytics';
import CreateSampleEvent from 'app/components/createSampleEvent';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import Button from 'app/components/button';

const Configure = createReactClass({
  displayName: 'Configure',
  contextTypes: {
    organization: SentryTypes.Organization,
  },

  getInitialState() {
    return {
      hasSentRealEvent: false,
    };
  },

  componentDidMount() {
    const {organization} = this.context;
    const {params} = this.props;
    const data = {
      project: params.projectId,
      platform: params.platform,
    };

    amplitude(
      'Viewed Onboarding Installation Instructions',
      parseInt(organization.id, 10),
      data
    );

    data.org_id = parseInt(organization.id, 10);
    analytics('onboarding.configure_viewed', data);
    this.sentRealEvent();
  },

  sentRealEvent() {
    const project = this.context.organization.projects.find(
      p => p.slug == this.props.params.projectId
    );
    let hasSentRealEvent = false;
    if (project && project.firstEvent) {
      hasSentRealEvent = true;
    }
    this.setState({hasSentRealEvent});
  },

  redirectUrl() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;

    const hasSentry10 = new Set(organization.features).has('sentry10');

    const url = hasSentry10
      ? `/organizations/${orgId}/issues/#welcome`
      : `/${orgId}/${projectId}/#welcome`;
    browserHistory.push(url);
  },

  submit() {
    const {projectId} = this.props.params;
    const {organization} = this.context;
    analytics('onboarding.complete', {project: projectId});
    amplitude(
      'Completed Onboarding Installation Instructions',
      parseInt(organization.id, 10),
      {projectId}
    );
    this.redirectUrl();
  },

  render() {
    const {orgId, projectId} = this.props.params;
    const {hasSentRealEvent} = this.state;

    return (
      <div>
        <div className="onboarding-Configure">
          <h2 style={{marginBottom: 30}}>
            {t('Configure your application')}
            {!hasSentRealEvent && (
              <CreateSampleEvent params={this.props.params} source="header" />
            )}
          </h2>
          <ProjectContext projectId={projectId} orgId={orgId} style={{marginBottom: 30}}>
            <ProjectDocsContext>
              <ProjectInstallPlatform
                platformData={{
                  hack:
                    'actually set by ProjectDocsContext, this object is here to avoid proptypes warnings',
                }}
                params={this.props.params}
                linkPath={(_orgId, _projectId, _platform) =>
                  `/onboarding/${_orgId}/${_projectId}/configure/${_platform}/`
                }
              />
            </ProjectDocsContext>
          </ProjectContext>
          <DoneButton>
            <Button
              priority="primary"
              data-test-id="configure-done"
              onClick={this.submit}
            >
              {t('All done!')}
            </Button>
          </DoneButton>
        </div>
      </div>
    );
  },
});

const DoneButton = styled('div')`
  display: grid;
  grid-template-columns: max-content;
  place-content: end;
  margin-bottom: 20px;
`;

export default Configure;
