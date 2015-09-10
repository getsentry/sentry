import React from "react";
import _ from "underscore";

import PropTypes from "../../proptypes";

import EventDataSection from "./eventDataSection";
import DefinitionList from "./interfaces/definitionList";

var EventExtraData = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render() {
    let extraDataArray = _.chain(this.props.event.context)
      .map((val, key) => [key, val])
      .value();

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="extra"
          title="Additional Data">
          <DefinitionList data={extraDataArray} isContextData={true}/>
      </EventDataSection>
    );
  }
});

export default EventExtraData;
