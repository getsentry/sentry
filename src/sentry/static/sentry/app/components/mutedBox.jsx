import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import DateTime from './dateTime';

const MutedBox = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    let statusDetails = this.props.statusDetails;
    return (
      <div className="alert alert-info alert-block">
        {statusDetails.snoozeUntil ?
          <span>This issue has been snoozed until <strong><DateTime date={statusDetails.snoozeUntil} /></strong> &mdash; </span>
        :
          <span>This issue has been muted &mdash; </span>
        }
        You will not be notified of any changes and it will not show up by
        default in feeds.
      </div>
    );
  }
});

export default MutedBox;

