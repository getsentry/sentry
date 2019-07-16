import PropTypes from 'prop-types';
import React from 'react';

import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import {t, tn} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import withApi from 'app/utils/withApi';

class ReleaseProjectStatSparkline extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string,
    project: PropTypes.object,
    version: PropTypes.string,
  };

  state = {
    loading: true,
    error: false,
    stats: [],
    newIssueCount: null,
  };

  componentDidMount() {
    Promise.all([
      this.getStatReceived(),
      this.getNewIssuesCount(),
      import(/* webpackChunkName: "ReactSparkLines" */ 'react-sparklines'),
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
  }

  getStatReceived() {
    const {api, orgId} = this.props;
    const projectId = this.props.project.slug;
    const path = `/projects/${orgId}/${projectId}/stats/`;
    return api.requestPromise(path, {
      method: 'GET',
      data: 'stat=received',
      success: data => {
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
  }

  getNewIssuesCount() {
    const {api, orgId, version} = this.props;
    const projectId = this.props.project.slug;
    const issuesPath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/`;
    return api.requestPromise(issuesPath, {
      method: 'GET',
      success: data => {
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
  }

  renderProjectSummary() {
    const {project} = this.props;
    const {newIssueCount} = this.state;

    return (
      <React.Fragment>
        <h6 className="m-b-0">{project.slug}</h6>
        <p className="m-b-0 text-muted">
          <small>
            {newIssueCount > 0
              ? tn('%s new issue', '%s new issues', newIssueCount)
              : t('No new issues')}
          </small>
        </p>
      </React.Fragment>
    );
  }

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    if (this.state.error) {
      return <LoadingError />;
    }

    const {Sparklines, SparklinesLine, stats} = this.state;
    const values = stats.map(tuple => tuple[1]);

    return (
      <li>
        <div className="sparkline pull-right" style={{width: 96}}>
          <Sparklines data={values} width={100} height={32}>
            <SparklinesLine style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}} />
          </Sparklines>
        </div>
        <div>{this.renderProjectSummary()}</div>
      </li>
    );
  }
}

export default withOrganization(withApi(ReleaseProjectStatSparkline));
