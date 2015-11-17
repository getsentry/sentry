import React from 'react';

import PureRenderMixin from 'react-addons-pure-render-mixin';

const EventActions = React.createClass({
  propTypes: {
    onRealtimeChange: React.PropTypes.func.isRequired,
    realtimeActive: React.PropTypes.bool.isRequired
  },

  mixins: [
    PureRenderMixin
  ],

  getInitialState() {
    return {
      datePickerActive: false
    };
  },

  onRealtimeChange(evt) {
    this.props.onRealtimeChange(!this.props.realtimeActive);
  },

  render() {
    return (
      <div className="stream-actions row">
        <div className="stream-actions-left col-md-7 col-sm-8 col-xs-8">
          <div className="btn-group">
            <a className="btn btn-default btn-sm hidden-xs realtime-control"
               onClick={this.onRealtimeChange}>
              {(this.props.realtimeActive ?
                <span className="icon icon-pause"></span>
                :
                <span className="icon icon-play"></span>
              )}
            </a>
          </div>
        </div>
      </div>
    );
  }
});

export default EventActions;

