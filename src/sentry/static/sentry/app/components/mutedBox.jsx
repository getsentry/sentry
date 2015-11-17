import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

const MutedBox = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    if (this.props.status !== 'muted') {
      return null;
    }
    return (
      <div className="alert alert-info alert-block">
        This event has been muted. You will not be notified of any changes and it will not show up in the default feed.
      </div>
    );
  }
});

export default MutedBox;

