import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import DateTime from './dateTime';

const MutedBox = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    if (this.props.status !== 'muted') {
      return null;
    }
    return (
      <div className="alert alert-info alert-block">
        {this.props.snoozeUntil ?
          <span>This event has been snoozed until <strong><DateTime date={this.props.snoozeUntil} /></strong> &mdash; </span>
        :
          <span>This event has been muted &mdash; </span>
        }
        You will not be notified of any changes and it will not show up by
        default in feeds.
      </div>
    );
  }
});

export default MutedBox;

