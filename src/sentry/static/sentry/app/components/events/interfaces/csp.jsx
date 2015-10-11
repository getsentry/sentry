import React from "react";
import _ from "underscore";
import PropTypes from "../../../proptypes";

import EventDataSection from "../eventDataSection";
import DefinitionList from "./definitionList";

var CSPInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {group, event, data} = this.props;

    let extraDataArray = _.chain(data)
      .map((val, key) => [key.replace(/_/g, '-'), val])
      .value();

    return (
      <EventDataSection
          group={group}
          event={event}
          type="csp"
          title="CSP Report">
          <DefinitionList data={extraDataArray} isContextData={true}/>
      </EventDataSection>
    );
  }
});

export default CSPInterface;
