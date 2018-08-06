import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';

import ApiMixin from 'app/mixins/apiMixin';

import {t, tn} from 'app/locale';

const ReleaseProjectStatSparkline = createReactClass({
  displayName: 'ReleaseProjectStatSparkline',

  propTypes: {
    orgId: PropTypes.string,
    project: PropTypes.object,
    version: PropTypes.string,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
      newIssueCount: null,
    };
  },

  componentDidMount() {
    Promise.all([
      this.getStatReceived(),
      this.getNewIssuesCount(),
      import(/*webpackChunkName "ReactSparkLines" */ 'react-sparklines'),
    ]).then(
      ([stats, newIssues, reactSparkLines]) => {
        this.setState({
          loading: false,
          stats,
          newIssueCount: newIssues && newIssues.newGroups,
          Sparklines: reactSparkLines.Sparklines,
          SparklinesLine: reactSparkLines.SparklinesLine,
          error: false,
        });
      },
      () => {
        this.setState({error: true});
      }
    );
  },

  getStatReceived() {
    let {orgId} = this.props;
    let projectId = this.props.project.slug;
    let path = `/projects/${orgId}/${projectId}/stats/`;
    return this.api.requestPromise(path, {
      method: 'GET',
      data: 'stat=received',
      success: (data, _, jqXHR) => {
        this.setState({
          stats: data,
        });
        this.getNewIssuesCount();
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
  },

  getNewIssuesCount() {
    let {orgId, version} = this.props;
    let projectId = this.props.project.slug;
    let issuesPath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/`;
    return this.api.requestPromise(issuesPath, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          newIssueCount: data.newGroups,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
  },

  render() {
    let {orgId, project, version} = this.props;

    if (this.state.loading) return <LoadingIndicator />;
    if (this.state.error) return <LoadingError />;

    let {Sparklines, SparklinesLine, newIssueCount, stats} = this.state;
    let values = stats.map(tuple => tuple[1]);

    return (
      <li>
        <div className="sparkline pull-right" style={{width: 96}}>
          <Sparklines data={values} width={100} height={32}>
            <SparklinesLine style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}} />
          </Sparklines>
        </div>
        <Link to={`/${orgId}/${project.slug}/releases/${encodeURIComponent(version)}/`}>
          <h6 className="m-b-0">{project.slug}</h6>
          <p className="m-b-0 text-muted">
            <small>
              {newIssueCount > 0
                ? tn('%d new issue', '%d new issues', newIssueCount)
                : t('No new issues')}
            </small>
          </p>
        </Link>
      </li>
    );
  },
});

export default ReleaseProjectStatSparkline;
