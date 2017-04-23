import React from 'react';
import IconCloseLg from '../icons/icon-close-lg';

const BroadcastModal = React.createClass({
  getInitialState() {
    return {
      alerts: ['foo', 'bar', 'baz', 'zig', 'zag'],
      index: 0
    };
  },

  componentWillMount() {
    $(document.body).addClass('modal-open');
  },

  componentWillUnmount() {
    $(document.body).removeClass('modal-open');
  },

  renderOneModal(message, i, a) {
    let nth = 'abcd'[a.length - 1 - i] + '-nth';
    console.log(a.length, i, nth);
    return (
      <div className={'modal ' + nth} style={{display: 'block'}} key={i}>
        <div className="modal-dialog">
          <div className="modal-content" role="document">
            <div className="modal-body">
              <div className="pull-right">
                <span
                  className="close-icon"
                  onClick={() => {
                    this.setState({index: this.state.index + 1});
                  }}
                >
                  <IconCloseLg />
                </span>
              </div>
              <h3>
                Releases are better with commits {message}
                {' '}
                <span className="badge badge-square badge-new">NEW</span>
              </h3>
              <p>
                <img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3O211Y3U0x2r371k2r26/broadcast-screenshot.png?X-CloudApp-Visitor-Id=17234&v=c85cb825" />
              </p>
              <p>
                Knowing what code changed recently is extremely helpful in determining the cause of an error. With that in mind, we’re excited to announce that we’ve expanded our Releases feature to support commit data. If you include commit data when creating a release, you’ll unlock a number of helpful features.
              </p>
              <p><a className="btn btn-primary btn-lg" href="#">Read the full post</a></p>
            </div>
          </div>
        </div>
      </div>
    );
  },

  render() {
    let {alerts, index} = this.state;
    let modals = alerts.slice(index, index + 4).reverse().map(this.renderOneModal);

    if (modals.length < 1) {
      this.componentWillUnmount();
      return null;
    }

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
