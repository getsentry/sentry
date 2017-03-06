import React from 'react';
import {Link} from 'react-router';

import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';

import {Sparklines, SparklinesLine} from 'react-sparklines';

import ApiMixin from '../mixins/apiMixin';

const ReleaseProjectStatSparkline = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string,
    project: React.PropTypes.object,
    version: React.PropTypes.string,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
      issues: 0,
    };
  },

  componentDidMount() {
    let {orgId} = this.props;
    let projectId = this.props.project.slug;
    let path = `/projects/${orgId}/${projectId}/stats/`;
    this.api.request(path, {
      method: 'GET',
      data: 'stat=received',
      success: (data, _, jqXHR) => {
        this.setState({
          stats: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
    let issuesPath = `/projects/${orgId}/${projectId}/issues/`;
    this.api.request(issuesPath, {
      method: 'GET',
      data: {'query': 'first-release:"' + this.props.version + '"'},
      success: (data, _, jqXHR) => {
        this.setState({
          issues: data.length,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  render() {
    let {orgId, project} = this.props;
    let values = this.state.stats.map(tuple => tuple[1]);
    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;
    return (
      <li>
        <div className="sparkline pull-right" style={{width: 96}}>
          <Sparklines data={values} width={100} height={32}>
            <SparklinesLine style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}}/>
          </Sparklines>
        </div>
        <Link to={`/${orgId}/${project.slug}/`}>
          <h6 className="m-b-0">
            {project.name}
          </h6>
          <p className="m-b-0">{this.state.issues} New Issues</p>
        </Link>
      </li>
    );
  }
});

export default ReleaseProjectStatSparkline;
