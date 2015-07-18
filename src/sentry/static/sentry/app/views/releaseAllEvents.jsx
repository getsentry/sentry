var React = require("react");
var Router = require("react-router");

var GroupList = require("../components/groupList");
var PropTypes = require("../proptypes");

var ReleaseAllEvents = React.createClass({
  contextTypes: {
    router: React.PropTypes.func,
    release: PropTypes.AnyModel
  },

  render() {
    return (
      <GroupList
        query={'release:"' + this.context.release.version + '"'}
        canSelectGroups={false} />
    );
  }
});

module.exports = ReleaseAllEvents;
