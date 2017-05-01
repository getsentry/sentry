import React from 'react';
import IconCloseLg from '../icons/icon-close-lg';
import ConfigStore from '../stores/configStore.jsx';
import ApiMixin from '../mixins/apiMixin';

const ReleaseAnnouncement = ({close}) => {
  const mediaUrl = ConfigStore.get('mediaUrl');
  return (
    <div>
      <h3>
        Releases are better with commits
        {' '}
        <span className="badge badge-square badge-new">NEW</span>
      </h3>
      <p>
        <img src={mediaUrl + 'dist/release-commits-modal.gif'} />
      </p>
      <p>
        Knowing what code changed recently is extremely helpful in determining the cause of an error. With that in mind, we’re excited to announce that we’ve expanded our Releases feature to support commit data. If you include commit data when creating a release, you’ll unlock a number of helpful features.
      </p>
      <p className="release-buttons">
        <a
          className="btn btn-primary btn-lg"
          href="https://blog.sentry.io/2017/05/01/release-commits.html"
          onClick={close}>
          Read the full post
        </a>
        <a className="btn btn-default btn-lg" href="#" onClick={close}>
          Dismiss
        </a>
      </p>
    </div>
  );
};

ReleaseAnnouncement.propTypes = {
  close: React.PropTypes.func.isRequired
};

const BroadcastModal = React.createClass({
  propTypes: {
    closeBroadcast: React.PropTypes.func.isRequired
  },
  mixins: [ApiMixin],

  getInitialState() {
    return {
      alerts: [ReleaseAnnouncement],
      index: 0
    };
  },

  componentWillMount() {
    document.addEventListener('keydown', this.handleKeyDown);
  },

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  },

  close() {
    //tell server to close
    let user = ConfigStore.get('user');
    let markedData = {options: {}};
    markedData.options.seenReleaseBroadcast = true;

    this.api.request(`/users/${user.id}/`, {
      method: 'PUT',
      data: markedData,
      success: (data, _, jqXHR) => {
        ConfigStore.set('user', data);
        this.props.closeBroadcast();
      },
      error: err => {
        this.props.closeBroadcast();
      }
    });
  },

  handleKeyDown(evt) {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      this.close();
    }
  },

  handleClick(evt) {
    if ([].includes.call(evt.target.classList, 'modal')) {
      this.close();
    }
  },

  renderOneModal(message, i, a) {
    let nth = 'abcd'[a.length - 1 - i] + '-nth';
    return (
      <div
        className={'modal ' + nth}
        style={{display: 'block'}}
        key={i}
        onClick={this.handleClick}>
        <div className="modal-dialog">
          <div className="modal-content" role="document">
            <div className="modal-body">
              <div className="pull-right">
                <span
                  className="close-icon"
                  onClick={() => {
                    if (this.state.index + 1 >= this.state.alerts.length) {
                      this.close();
                    }
                    this.setState({index: this.state.index + 1});
                  }}>
                  <IconCloseLg />
                </span>
              </div>
              {message({close: this.close})}
            </div>
          </div>
        </div>
      </div>
    );
  },

  render() {
    let {alerts, index} = this.state;
    let modals = alerts.slice(index, index + 4).reverse().map(this.renderOneModal);
    return (
      <div className="modal-broadcast">
        <div className="modal-backdrop in" />
        <div className="modals">
          {modals}
        </div>
      </div>
    );
  }
});

export default BroadcastModal;
