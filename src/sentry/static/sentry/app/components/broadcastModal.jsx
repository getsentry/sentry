import React from 'react';
import IconCloseLg from '../icons/icon-close-lg';

const BroadcastModal = React.createClass({
  getInitialState() {
    return {
      alerts: []
    };
  },

  componentWillMount() {
    $(document.body).addClass('modal-open');
  },

  componentWillUnmount() {
    $(document.body).removeClass('modal-open');
  },

  render() {
    return (
      <div className="modal-broadcast">
        <div className="modal-backdrop in" />
        <div className="modals">
          <div className="modal" style={{display: 'block'}}>
            <div className="modal-dialog">
              <div className="modal-content" role="document">
                <div className="modal-body">
                  <div className="pull-right">
                    <span className="close-icon">
                      <IconCloseLg />
                    </span>
                  </div>
                  <h3>Releases are better with commits <span className="badge badge-square badge-new">NEW</span></h3>
                  <p><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3O211Y3U0x2r371k2r26/broadcast-screenshot.png?X-CloudApp-Visitor-Id=17234&v=c85cb825" /></p>
                  <p>Knowing what code changed recently is extremely helpful in determining the cause of an error. With that in mind, we’re excited to announce that we’ve expanded our Releases feature to support commit data. If you include commit data when creating a release, you’ll unlock a number of helpful features.</p>
                  <p><a className="btn btn-primary btn-lg" href="#">Read the full post</a></p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal" style={{display: 'block'}}>
            <div className="modal-dialog">
              <div className="modal-content" role="document">
                <div className="modal-body">
                  <div className="pull-right">
                    <span className="close-icon">
                      <IconCloseLg />
                    </span>
                  </div>
                  <h3>Releases are better with commits <span className="badge badge-square badge-new">NEW</span></h3>
                  <p><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3O211Y3U0x2r371k2r26/broadcast-screenshot.png?X-CloudApp-Visitor-Id=17234&v=c85cb825" /></p>
                  <p>Knowing what code changed recently is extremely helpful in determining the cause of an error. With that in mind, we’re excited to announce that we’ve expanded our Releases feature to support commit data. If you include commit data when creating a release, you’ll unlock a number of helpful features.</p>
                  <p><a className="btn btn-primary btn-lg" href="#">Read the full post</a></p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal" style={{display: 'block'}}>
            <div className="modal-dialog">
              <div className="modal-content" role="document">
                <div className="modal-body">
                  <div className="pull-right">
                    <span className="close-icon">
                      <IconCloseLg />
                    </span>
                  </div>
                  <h3>Releases are better with commits <span className="badge badge-square badge-new">NEW</span></h3>
                  <p><img src="https://d3vv6lp55qjaqc.cloudfront.net/items/3O211Y3U0x2r371k2r26/broadcast-screenshot.png?X-CloudApp-Visitor-Id=17234&v=c85cb825" /></p>
                  <p>Knowing what code changed recently is extremely helpful in determining the cause of an error. With that in mind, we’re excited to announce that we’ve expanded our Releases feature to support commit data. If you include commit data when creating a release, you’ll unlock a number of helpful features.</p>
                  <p><a className="btn btn-primary btn-lg" href="#">Read the full post</a></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default BroadcastModal;
