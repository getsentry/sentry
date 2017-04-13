import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import BarChart from '../components/barChart';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ReleaseProjectStatSparkline from '../components/releaseProjectStatSparkline';
import TimeSince from '../components/timeSince';
import TooltipMixin from '../mixins/tooltip';
import {getShortVersion} from '../utils';

const Chart = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, version} = this.props;
    let path = `/organizations/${orgId}/releases/${version}/stats/`;
    this.api.request(path, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          stats: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  renderBody() {
    if (this.state.loading)
      return null;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let points = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="chart-wrapper">
        <BarChart
          points={points}
          className="sparkline" />
      </div>
    );
  },

  render() {
    return <div className="chart-container">{this.renderBody()}</div>;
  },
});


export default React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    version: React.PropTypes.string.isRequired,
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    }),
  ],

  getInitialState() {
    return {
      isModalOpen: false,
      loading: true,
      error: false,
      dataFetchSent: false,
      data: null,
    };
  },

  optimisticallyFetchData() {
    if (this.state.dataFetchSent)
      return;

    this.setState({dataFetchSent: true});

    this.getDetails();
  },

  getDetails() {
    let {orgId, version} = this.props;
    let path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;
    this.api.request(path, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          data: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onOpen() {
    this.setState({isModalOpen: true}, this.optimisticallyFetchData);
  },

  onClose() {
    this.setState({isModalOpen: false});
  },

  renderModal() {
    return (
      <Modal show={this.state.isModalOpen} onHide={this.onClose} animation={false}>
        <div className="modal-body">
          {this.renderModalBody()}
        </div>
      </Modal>
    );
  },

  renderEmpty() {
    return <div className="box empty">None</div>;
  },

  renderReleaseWeight(release) {
    let width = release.commitCount / release.projectCommitStats.maxCommits * 100;
    let fullBar = {
      width: '100px',
      backgroundColor: '#d3d3d3',
      height: '5px',
      borderRadius: '3px',
      position: 'relative',
      display: 'inline-block',
    };
    let percentageBar = {
      width: width + 'px',
      backgroundColor: '#8F85D4',
      height: '5px',
    };
    if (width === 100) {
      percentageBar.borderRadius = '3px';
    } else {
      percentageBar.borderBottomLeftRadius = '3px';
      percentageBar.borderTopLeftRadius = '3px';
    }
    return (
      <div className="tip"
           title={('This release has ' +
                   (Math.round((release.commitCount - release.projectCommitStats.avgCommits) * 100) / 100) +
                   ' more commits than the average for this project.')}
           style={fullBar}>
        <div style={percentageBar}></div>
      </div>
    );
  },

  renderModalBody() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError />;

    let {orgId, projectId, version} = this.props;
    let shortVersion = getShortVersion(version);
    let {data} = this.state;

    return (
      <div className="release-details-modal">
        <div className="release-details-banner">
          <Chart {...this.props} />
        </div>
        <div className="release-details-inner">
          <div className="release-details-header">
            <div className="release-name">
              <h5>{shortVersion}</h5>
              <small>Created <TimeSince date={data.dateCreated} /></small>
            </div>
            <div className="release-action">
              <Link to={`/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`} className="btn btn-default">
                Details
              </Link>
            </div>
            <div className="clearfix" />
          </div>
          <div className="row release-info">
            <div className="col-md-6">
              <h6 className="nav-header">Summary</h6>
              <dl className="flat">
                <dt>Weight:</dt>
                <dd>
                  {this.renderReleaseWeight(data)}<br />
                  <small>{data.commitCount.toLocaleString()} commits</small>
                </dd>
                <dt>Authors:</dt>
                <dd>{data.authors.map(author => {
                  return <span style={{marginRight: 5}}><Avatar user={author} /></span>;
                })}</dd>
              </dl>
            </div>
            <div className="col-md-6">
              <h6 className="nav-header">Impact</h6>
              <dl className="flat">
                <dt>New Issues:</dt>
                <dd><a>{data.newGroups.toLocaleString()}</a></dd>
                <dt>First Event:</dt>
                <dd><TimeSince date={data.firstEvent} /></dd>
                <dt>Last Event:</dt>
                <dd><TimeSince date={data.lastEvent} /></dd>
              </dl>
            </div>
          </div>
          <div className="release-info">
            <h6 className="nav-header">Projects Affected</h6>
            <ul className="nav nav-stacked row project-list">
              {data.projects.map((project) => {
                return (
                  <ReleaseProjectStatSparkline
                    className="col-md-6"
                    key={project.id}
                    orgId={orgId}
                    project={project}
                    version={version}
                  />
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  },

  render() {
    let {version} = this.props;
    let shortVersion = getShortVersion(version);
    return (
      <a onClick={this.onOpen}>
        <span title={version}>{shortVersion}</span>
        {this.renderModal()}
      </a>
    );
  },
});
