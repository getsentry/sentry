import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import GeoMap from '../components/geoMap_MapBox';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';

const LocationsMap = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    user: React.PropTypes.object.isRequired,
    height: React.PropTypes.number,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      height: 450,
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
    let {orgId, projectId, user} = this.props;
    return `/projects/${orgId}/${projectId}/users/${user.hash}/locations/`;
  },

  renderBody() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    return <GeoMap defaultZoom={0} series={this.state.data} height={this.props.height} />;
  },

  render() {
    return <div style={{height: this.props.height}}>{this.renderBody()}</div>;
  },
});

export default React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    user: React.PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      isModalOpen: false,
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
    let {orgId, projectId, user} = this.props;
    return `/projects/${orgId}/${projectId}/users/${user.hash}/`;
  },

  onOpen() {
    this.setState({isModalOpen: true});
  },

  onClose() {
    this.setState({isModalOpen: false});
  },

  getDisplayName(user) {
    return (
      user.name ||
      `${user.ipAddress} (anonymous)`
    );
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

  renderModalBody() {
    if (this.state.loading)
      return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {user} = this.props;

    return (
      <div style={{
          overflow: 'hidden',
          margin: '-20px -30px 0',
      }}>
        <div style={{marginTop: -130, position: 'relative'}}>
          <LocationsMap {...this.props} />
        </div>
        <div style={{padding: '20px 30px 0', borderTop: '1px solid #ccc',  marginTop: -160, background: '#fff', opacity: 0.9}}>
          <div className="user-details-header">
            <Avatar user={user} size={128} />
            <div className="user-name">
              <h5>{this.getDisplayName(user)}</h5>
              <small>{user.email || user.ipAddress || ''}</small>
            </div>
            <div className="user-action">
              {user.email &&
                <a href={`mailto:${user.email}`} className="btn btn-default">Send an email</a>
              }
            </div>
            <div className="clearfix" />
          </div>
          <div className="row">
            <div className="col-md-5">
            </div>
            <div className="col-md-7">
              <h6 className="nav-header">Other Info</h6>
              <dl className="flat">
                <dt>ID:</dt>
                <dd>{user.id || <em>n/a</em>}</dd>
                <dt>Username:</dt>
                <dd>{user.username || <em>n/a</em>}</dd>
                <dt>IP Address:</dt>
                <dd>{user.ipAddress || <em>n/a</em>}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    );
  },

  render() {
    return (
      <a onClick={this.onOpen}>
        {this.getDisplayName(this.props.user)}
        {this.renderModal()}
      </a>
    );
  },
});
