import React from "react";
import DateTime from "../../components/dateTime";
import TimeSince from "../../components/timeSince";
import Version from "../../components/version";
import utils from "../../utils";

var SeenInfo = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired
    }),
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  render() {
    var {date, release} = this.props;
    return (
      <dl>
        <dt key={0}>When:</dt>
        <dd key={1}><TimeSince date={date} /></dd>
        <dt key={2}>Date:</dt>
        <dd key={3}><DateTime date={date} /></dd>
        {utils.defined(release) && [
          <dt key={4}>Release:</dt>,
          <dd key={5}><Version orgId={this.props.orgId} projectId={this.props.projectId} version={release.version} /></dd>
        ]}
      </dl>
    );
  }
});

export default SeenInfo;
