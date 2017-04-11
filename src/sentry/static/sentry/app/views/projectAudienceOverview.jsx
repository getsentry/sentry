import moment from 'moment';
import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import countryCodes from '../utils/countryCodes';
import GeoMap from '../components/geoMap';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import TimeSince from '../components/timeSince';

import {BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip} from 'recharts';

const Location = React.createClass({
  render() {
    let {location} = this.props;
    if (!location)
      return null;
    if (location.city && location.region)
      return (
        <div>
          <div>{location.city}, {location.region}</div>
          <small>{location.country}</small>
        </div>
      );
    return (
      <div>
        <div>{location.city}</div>
        <small>{location.country}</small>
      </div>
    );
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

  getDisplayName(user) {
    return (
      user.username ||
      user.email ||
      user.identifier ||
      `${user.ipAddress} (anonymous)`
    );
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId, projectId} = this.props.params;
    return (
      <table className="table table-bordered user-list">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Last Hit an Issue</th>
          </tr>
        </thead>
        <tbody>
          {this.state.data.map((user) => {
            let link = `/${orgId}/${projectId}/audience/users/${user.hash}/`;
            return (
              <tr key={user.id}>
                <td>
                  <Avatar user={user} size={36} />
                  <Link to={link}>{this.getDisplayName(user)}</Link><br />
                  <small>First seen <TimeSince date={user.dateCreated} /></small>
                </td>
                <td><Location location={user.lastLocation} /></td>
                <td><TimeSince date={user.lastIssue.lastSeen} /><br /><small>{user.lastIssue.project.name}</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
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
      <div className="panel panel-default">
        <ResponsiveContainer minHeight={150}>
          <BarChart data={series} barGap={10}>
           <XAxis dataKey="name" tickLine={false} stroke="#ccc" />
           <YAxis tickLine={false} stroke="#ccc" />
           <Tooltip/>
           <Bar type="monotone" dataKey="count" fill="#ef8675" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  },
});

const LocationsMap = React.createClass({
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
    return `/projects/${orgId}/${projectId}/locations/`;
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let series = this.state.data.map(t => [countryCodes[t.value], t.count]);
    let {highlight} = this.props.location.query;
    if (highlight) {
      highlight = countryCodes[highlight];
    }
    return (
      <GeoMap highlightCountryCode={highlight} series={series} height={200} />
    );
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

  getDisplayName(feedback) {
    if (feedback.name)
      return feedback.name;
    else if (feedback.email)
      return feedback.email;
    else if (feedback.user)
      return feedback.user.username || feedback.user.email || <em>Anonymous</em>;
    return <em>Anonymous</em>;
  },

  render() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId, projectId} = this.props.params;
    return (
      <ul>
        {this.state.data.map((feedback) => {
          return (
            <li key={feedback.id}>
              <Avatar user={feedback.user} />
              {feedback.user ?
                <Link to={`/${orgId}/${projectId}/audience/users/${feedback.user.hash}/`}>{this.getDisplayName(feedback)}</Link>
              :
                <strong>{this.getDisplayName(feedback)}</strong>
              }
              {feedback.comments}
              <TimeSince date={feedback.dateCreated} />
            </li>
          );
        })}
      </ul>
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
        <div style={{padding: '20px 30px 0', borderTop: '1px solid #ccc',  marginTop: -180, background: '#fff', opacity: 0.8}}>
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
