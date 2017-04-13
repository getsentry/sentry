import moment from 'moment';
import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import EventUserModalLink from '../components/eventUserModalLink';
import EventUserList from '../components/eventUserList';
import GeoMap from '../components/geoMap_MapBox';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import TimeSince from '../components/timeSince';

import {BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip} from 'recharts';

const CustomTooltip = React.createClass({
  propTypes: {
    active: React.PropTypes.bool,
    payload: React.PropTypes.array,
    label: React.PropTypes.string,
  },

  render() {
    const {active} = this.props;

    if (active) {
      const {payload, label} = this.props;
      return (
        <div className="tooltip-inner">
          <div className="time-label">{label}</div>
          <div className="value-label">{payload[0].value} users</div>
        </div>
      );
    }

    return null;
  }
});

const UsersAffectedList = React.createClass({
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
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
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

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/users/?per_page=10`;
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId, projectId} = this.props.params;
    return <EventUserList data={this.state.data} orgId={orgId} projectId={projectId} />;

  }
});

const UsersAffectedChart = React.createClass({
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
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
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

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/user-stats/`;
  },

  xTick() {
    return <span style={{fontSize: 12}} />;
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let series = this.state.data.map((p) => {
      return {
        name: moment(p[0] * 1000).format('ll'),
        count: p[1],
      };
    });

    return (
      <div className="panel panel-default" style={{overflow: 'hidden'}}>
        <div style={{marginLeft: '-25'}}>
          <ResponsiveContainer minHeight={150}>
            <BarChart data={series} barGap={10} margin={{top: 25, right: 30, left: 0, bottom: 5}}>
             <XAxis dataKey="name" tickLine={false} stroke="#ccc" />
             <YAxis tickLine={false} stroke="#ccc" />
             <Tooltip content={<CustomTooltip />} isAnimationActive={false}/>
             <Bar type="monotone" dataKey="count" fill="#ef8675"
                  isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
});

const LocationsMap = React.createClass({
  propTypes: {
    params: React.PropTypes.object.isRequired,
    height: React.PropTypes.number,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      height: 600,
    };
  },

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
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
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

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/locations/`;
  },

  renderBody() {
    if (this.state.loading)
      return null;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    return <GeoMap  series={this.state.data} height={this.props.height} />;
  },

  render() {
    return <div style={{height: this.props.height}} className="map-container">{this.renderBody()}</div>;
  },
});

const Feedback = React.createClass({
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
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
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

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/user-feedback/?per_page=10`;
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId, projectId} = this.props.params;
    return (
      <div className="audience-feedback">
        {this.state.data.map((feedback) => {
          return (
            <div className="audience-feedback-item" key={feedback.id}>
              <Avatar user={feedback.user || feedback} size={36} />
              <div className="pull-right">
                <TimeSince date={feedback.dateCreated} />
              </div>
              <div className="audience-feedback-name">
                {feedback.user ?
                  <EventUserModalLink orgId={orgId} projectId={projectId} user={feedback.user} />
                :
                  <strong>{feedback.name || <em>anonymous</em>}</strong>
                }
              </div>
              <div className="audience-feedback-body">
                {feedback.comments}
              </div>
              {feedback.issue &&
                <div className="audience-feedback-short-id">
                  <div className="audience-feedback-short-id">
                    <Link to={`/${orgId}/${projectId}/issues/${feedback.issue.id}/`}>{feedback.issue.shortId}</Link>
                  </div>
                </div>
              }
            </div>
          );
        })}
      </div>
    );
  }
});

export default React.createClass({
  render() {
    return (
      <div style={{
          overflow: 'hidden',
          margin: '-20px -30px 0',
      }}>
        <div style={{marginTop: -110, position: 'relative'}}>
          <LocationsMap {...this.props} />
        </div>
        <div style={{padding: '20px 30px 0', borderTop: '1px solid #ccc',  marginTop: -180, background: '#fff', opacity: 0.9}}>
          <div className="row">
            <div className="col-md-8">
              <h5>Users Affected</h5>
              <UsersAffectedChart {...this.props} />
              <UsersAffectedList {...this.props} />
            </div>
            <div className="col-md-4">
              <h5>Feedback</h5>
              <Feedback {...this.props} />
            </div>
          </div>
        </div>
      </div>
    );
  },
});
