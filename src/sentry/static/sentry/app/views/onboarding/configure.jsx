import {browserHistory} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {analytics, amplitude} from 'app/utils/analytics';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ProjectContext from 'app/views/projects/projectContext';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import CreateSampleEventButton from './createSampleEventButton';

class Configure extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  state = {
    hasSentRealEvent: false,
  };

  componentDidMount() {
    const {organization, params} = this.props;
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
  }

  get project() {
    return this.props.organization.projects.find(
      p => p.slug === this.props.params.projectId
    );
  }

  sentRealEvent() {
    const project = this.project;
    let hasSentRealEvent = false;
    if (project && project.firstEvent) {
      hasSentRealEvent = true;
    }
    this.setState({hasSentRealEvent});
  }

  redirectUrl() {
    const {orgId} = this.props.params;

    const url = `/organizations/${orgId}/issues/#welcome`;
    browserHistory.push(url);
  }

  submit = () => {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    analytics('onboarding.complete', {project: projectId});
    amplitude(
      'Completed Onboarding Installation Instructions',
      parseInt(organization.id, 10),
      {projectId}
    );
    this.redirectUrl();
  };

  render() {
    const {orgId, projectId} = this.props.params;
    const {hasSentRealEvent} = this.state;

    return (
      <div>
        <div className="onboarding-Configure">
          <h2 style={{marginBottom: 30}}>
            {t('Configure your application')}
            {!hasSentRealEvent && (
              <div className="pull-right">
                <CreateSampleEventButton project={this.project} source="header">
                  {t('Or Create a Sample Event')}
                </CreateSampleEventButton>
              </div>
            )}
          </h2>
          <ProjectContext projectId={projectId} orgId={orgId} style={{marginBottom: 30}}>
            <ProjectInstallPlatform params={this.props.params} />
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
  }
}

const DoneButton = styled('div')`
  display: grid;
  grid-template-columns: max-content;
  place-content: end;
  margin-bottom: 20px;
`;

export default withOrganization(Configure);
