import $ from 'jquery';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import EventUserReport from '../components/events/userReport';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const GroupUserReports = createReactClass({
  displayName: 'GroupUserReports',
  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      reportList: [],
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (prevProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  },

  fetchData() {
    let queryParams = this.props.params;
    let querystring = $.param(queryParams);

    this.setState({
      loading: true,
      error: false,
    });

    this.api.request('/issues/' + this.getGroup().id + '/user-reports/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getUserReportsUrl() {
    let params = this.props.params;

    return `/${params.orgId}/${params.projectId}/settings/user-feedback/`;
  },

  render() {
    let {reportList} = this.state;
    let {projectId, orgId, groupId} = this.props.params;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (reportList.length) {
      return (
        <div className="row">
          <div className="col-md-9">
            {reportList.map((item, idx) => {
              return (
                <EventUserReport
                  key={idx}
                  report={item}
                  projectId={projectId}
                  orgId={orgId}
                  issueId={groupId}
                />
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('No user reports have been collected for this event.')}</p>
        <p>
          <Link to={this.getUserReportsUrl()}>
            {t('Learn how to integrate User Feedback')}
          </Link>
        </p>
      </div>
    );
  },
});

export default GroupUserReports;
