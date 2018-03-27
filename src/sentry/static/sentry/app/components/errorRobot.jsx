import React from 'react';
import PropTypes from 'prop-types';
import {Link, browserHistory} from 'react-router';
import createReactClass from 'create-react-class';

import ApiMixin from '../mixins/apiMixin';
import {t} from '../locale';

const ErrorRobot = createReactClass({
  displayName: 'ErrorRobot',

  propTypes: {
    org: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    sampleIssueId: PropTypes.string,
    gradient: PropTypes.bool,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: false,
      loading: !this.props.sampleIssueId,
      sampleIssueId: this.props.sampleIssueId,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let {org, project} = this.props;
    let {sampleIssueId} = this.state;

    if (!sampleIssueId) {
      let url = '/projects/' + org.slug + '/' + project.slug + '/issues/';
      let requestParams = {limit: 1};
      this.api.request(url, {
        method: 'GET',
        data: requestParams,
        success: (data, ignore, jqXHR) => {
          this.setState({
            loading: false,
            sampleIssueId: data.length > 0 && data[0].id,
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
      sampleLink = sampleIssueId ? (
        <p>
          <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
            {t('Or see your sample event')}
          </Link>
        </p>
      ) : (
        <p>
          <a onClick={this.createSampleEvent}>{t('Create a sample event')}</a>
        </p>
      );
    }
    return (
      <div
        className="box awaiting-events"
        style={
          gradient && {backgroundImage: 'linear-gradient(to bottom, #F8F9FA, #ffffff)'}
        }
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
            <a
              className="btn btn-primary btn-lg"
              href="/tes/django/getting-started/python-django"
            >
              Installation Instructions
            </a>
          </p>
          {sampleLink}
        </div>
      </div>
    );
  },
});

export default ErrorRobot;
