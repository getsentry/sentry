import React from 'react';
import PropTypes from 'prop-types';
import {Link, browserHistory} from 'react-router';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import {t} from 'app/locale';

const ErrorRobot = createReactClass({
  displayName: 'ErrorRobot',

  propTypes: {
    org: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    // sampleIssueId can have 3 values:
    // - empty string to indicate it doesn't exist (render "create sample event")
    // - non-empty string to indicate it exists (render "see sample event")
    // - null/undefined to indicate the project API should be consulted to find out
    sampleIssueId: PropTypes.string,
    gradient: PropTypes.bool,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: false,
      loading:
        this.props.sampleIssueId === null || this.props.sampleIssueId === undefined,
      sampleIssueId: this.props.sampleIssueId,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let {org, project} = this.props;
    let {sampleIssueId} = this.state;

    if (sampleIssueId === null || sampleIssueId === undefined) {
      let url = '/projects/' + org.slug + '/' + project.slug + '/issues/';
      let requestParams = {limit: 1};
      this.api.request(url, {
        method: 'GET',
        data: requestParams,
        success: (data, ignore, jqXHR) => {
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
  },

  createSampleEvent() {
    let {org, project} = this.props;
    let url = `/projects/${org.slug}/${project.slug}/create-sample/`;
    this.api.request(url, {
      method: 'POST',
      success: data => {
        browserHistory.push(`/${org.slug}/${project.slug}/issues/${data.groupID}/`);
      },
    });
  },

  render() {
    let {loading, error, sampleIssueId} = this.state;
    let {org, project, gradient} = this.props;
    let sampleLink;

    if (!loading && !error) {
      sampleLink =
        sampleIssueId === '' ? (
          <p>
            <a onClick={this.createSampleEvent}>{t('Create a sample event')}</a>
          </p>
        ) : (
          <p>
            <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
              {t('Or see your sample event')}
            </Link>
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
            <Link
              to={`/${org.slug}/${project.slug}/getting-started/${project.platform ||
                ''}`}
              className="btn btn-primary btn-lg"
            >
              {t('Installation Instructions')}
            </Link>
          </p>
          {sampleLink}
        </div>
      </ErrorRobotWrapper>
    );
  },
});

export default ErrorRobot;

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
