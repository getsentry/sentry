import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import InlineSvg from 'app/components/inlineSvg';
import ConfigStore from 'app/stores/configStore';
import ApiMixin from 'app/mixins/apiMixin';
import {logAjaxError} from 'app/utils/logging';

const ReleaseAnnouncement = ({close}) => {
  const mediaUrl = ConfigStore.get('mediaUrl');
  return (
    <div>
      <h3>
        Releases are better with commits{' '}
        <span className="badge badge-square badge-new">NEW</span>
      </h3>
      <p>
        <img src={mediaUrl + 'images/onboarding/release-commits-modal.gif'} />
      </p>
      <h5 style={{lineHeight: '1.2'}}>
        By integrating commit data with Sentry, you’ll unlock a number of helpful
        features:
      </h5>
      <ul>
        <li>
          Enhanced releases overview page that allows you to see new and resolved issues,
          files changed and authors all in the same place
        </li>
        <li>Resolving Sentry issues via commit messages</li>
        <li>Suggested assignees for issues</li>
        <li>Detailed summary emails when a deploy goes out</li>
      </ul>
      <p className="release-buttons">
        <a className="btn btn-default btn-lg" href="#" onClick={close}>
          Dismiss
        </a>
        <a
          className="btn btn-primary btn-lg"
          href="https://blog.sentry.io/2017/05/01/release-commits.html"
          onClick={close}
        >
          Read the full post
        </a>
      </p>
    </div>
  );
};

ReleaseAnnouncement.propTypes = {
  close: PropTypes.func.isRequired,
};

const BroadcastModal = createReactClass({
  displayName: 'BroadcastModal',

  propTypes: {
    closeBroadcast: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      alerts: [ReleaseAnnouncement],
      index: 0,
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
    let markedData = {
      options: {
        seenReleaseBroadcast: true,
      },
    };
    this.api.request(`/users/${user.id}/`, {
      method: 'PUT',
      data: markedData,
      success: (data, _, jqXHR) => {
        ConfigStore.set('user', data);
        this.props.closeBroadcast();
      },
      error: err => {
        logAjaxError(err);
        this.props.closeBroadcast();
      },
    });
  },

  handleKeyDown(evt) {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      this.close();
    }
  },

  handleClick(evt) {
    if ([].indexOf.call(evt.target.classList, 'modal') !== -1) {
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
        onClick={this.handleClick}
      >
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
                  }}
                >
                  <InlineSvg src="icon-close-lg" />
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
    let modals = alerts
      .slice(index, index + 4)
      .reverse()
      .map(this.renderOneModal);
    return (
      <div className="modal-broadcast">
        <div className="modal-backdrop in" />
        <div className="modals">{modals}</div>
      </div>
    );
  },
});

export default BroadcastModal;
