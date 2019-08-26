import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import CreateSampleEventButton from 'app/views/onboarding/createSampleEventButton';
import withApi from 'app/utils/withApi';

class ErrorRobot extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    org: PropTypes.object.isRequired,
    project: PropTypes.object,

    // sampleIssueId can have 3 values:
    // - empty string to indicate it doesn't exist (render "create sample event")
    // - non-empty string to indicate it exists (render "see sample event")
    // - null/undefined to indicate the project API should be consulted to find out
    sampleIssueId: PropTypes.string,

    gradient: PropTypes.bool,
  };

  state = {
    error: false,
    loading: false,
    sampleIssueId: this.props.sampleIssueId,
  };

  componentWillMount() {
    this.fetchData();
  }

  fetchData() {
    const {org, project} = this.props;
    const {sampleIssueId} = this.state;

    if (!project) {
      return;
    }

    if (sampleIssueId === null || sampleIssueId === undefined) {
      const url = '/projects/' + org.slug + '/' + project.slug + '/issues/';
      const requestParams = {limit: 1};

      this.setState({loading: true});
      this.props.api.request(url, {
        method: 'GET',
        data: requestParams,
        success: data => {
          this.setState({
            loading: false,
            sampleIssueId: (data.length > 0 && data[0].id) || '',
          });
        },
        error: err => {
          let error = err.responseJSON || true;
          error = error.detail || true;
          this.setState({
            error,
            loading: false,
          });
        },
      });
    }
  }

  render() {
    const {loading, error, sampleIssueId} = this.state;
    const {org, project, gradient} = this.props;
    let sampleLink;

    if (!loading && !error) {
      sampleLink = sampleIssueId ? (
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
            size="large"
            organization={org}
            project={project}
            source="issues_list"
            disabled={!project}
            title={!project ? t('Select a project to create a sample event') : null}
          >
            {t('Create a sample event')}
          </CreateSampleEventButton>
        </p>
      );
    }

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
                size="large"
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

const ErrorRobotWrapper = styled('div')`
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
  border-radius: 0 0 3px 3px;
  ${p =>
    p.gradient
      ? `
          background-image: linear-gradient(to bottom, #F8F9FA, #ffffff);
         `
      : ''};
`;
