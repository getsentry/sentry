import {Link} from 'react-router';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import CreateSampleEventButton from 'app/views/onboarding/createSampleEventButton';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {LightWeightOrganization, Project} from 'app/types';
import {defined} from 'app/utils';

type Props = {
  api: Client;
  org: LightWeightOrganization;
  project?: Project;
  gradient: boolean;
  /**
   * sampleIssueId can have 3 values:
   * - empty string to indicate it doesn't exist (render "create sample event")
   * - non-empty string to indicate it exists (render "see sample event")
   * - undefined to indicate the project API should be consulted to find out
   */
  sampleIssueId?: string;
};

type State = {
  error: boolean;
  loading: boolean;
  sampleIssueId?: string;
};

class ErrorRobot extends React.Component<Props, State> {
  state: State = {
    error: false,
    loading: false,
    sampleIssueId: this.props.sampleIssueId,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {org, project} = this.props;
    const {sampleIssueId} = this.state;

    if (!project) {
      return;
    }

    if (defined(sampleIssueId)) {
      return;
    }

    const url = `/projects/${org.slug}/${project.slug}/issues/`;

    this.setState({loading: true});

    try {
      const data = await this.props.api.requestPromise(url, {
        method: 'GET',
        data: {limit: 1},
      });
      this.setState({sampleIssueId: (data.length > 0 && data[0].id) || ''});
    } catch (err) {
      const error = err?.responseJSON?.detail ?? true;
      this.setState({error});
    }

    this.setState({loading: false});
  }

  render() {
    const {loading, error, sampleIssueId} = this.state;
    const {org, project, gradient} = this.props;

    const sampleLink =
      project && (loading || error ? null : sampleIssueId) ? (
        <p>
          <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
            {t('Or see your sample event')}
          </Link>
        </p>
      ) : (
        <p>
          <CreateSampleEventButton
            priority="link"
            borderless
            project={project}
            source="issues_list"
            disabled={!project}
            title={!project ? t('Select a project to create a sample event') : undefined}
          >
            {t('Create a sample event')}
          </CreateSampleEventButton>
        </p>
      );

    return (
      <ErrorRobotWrapper
        data-test-id="awaiting-events"
        className="awaiting-events"
        gradient={gradient}
      >
        <div className="wrap">
          <div className="robot">
            <span className="eye" />
          </div>
          <h3>Waiting for events…</h3>
          <p>
            <span>
              <span>Our error robot is waiting to </span>
              <span className="strikethrough">
                <span>devour</span>
              </span>
              <span> receive your first event.</span>
            </span>
          </p>
          <p>
            {project && (
              <Button
                data-test-id="install-instructions"
                priority="primary"
                to={`/${org.slug}/${project.slug}/getting-started/${project.platform ||
                  ''}`}
              >
                {t('Installation Instructions')}
              </Button>
            )}
          </p>
          {sampleLink}
        </div>
      </ErrorRobotWrapper>
    );
  }
}

export {ErrorRobot};

export default withApi(ErrorRobot);

const ErrorRobotWrapper = styled('div')<{gradient: boolean}>`
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
  border-radius: 0 0 3px 3px;
  ${p =>
    p.gradient
      ? `
          background-image: linear-gradient(to bottom, #F8F9FA, #ffffff);
         `
      : ''};
`;
