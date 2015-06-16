var React = require("react");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var MutedBox = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    if (this.props.status !== 'muted') {
      return <div />;
    }
    return (
      <div className="alert alert-info">
        This event has been muted. You will not be notified of any changes and it will not show up in the default feed.
      </div>
    );
  }
});

module.exports = MutedBox;
