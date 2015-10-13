import React from "react";

import {logException} from "../../utils/logging";
import EventDataSection from "./eventDataSection";
import EventErrors from "./errors";
import EventExtraData from "./extraData";
import EventPackageData from "./packageData";
import EventTags from "./eventTags";
import EventMessage from "./message";
import EventUser from "./user";
import PropTypes from "../../proptypes";
import utils from "../../utils";

var EventEntries = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    // TODO(dcramer): ideally isShare would be replaced with simple permission
    // checks
    isShare: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      isShare: false
    };
  },

  // TODO(dcramer): make this extensible
  interfaces: {
    exception: require("./interfaces/exception"),
    request: require("./interfaces/request"),
    stacktrace: require("./interfaces/stacktrace"),
    template: require("./interfaces/template"),
    csp: require("./interfaces/csp"),
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render(){
    var group = this.props.group;
    var evt = this.props.event;
    var isShare = this.props.isShare;

    var entries = evt.entries.map((entry, entryIdx) => {
      try {
        var Component = this.interfaces[entry.type];
        if (!Component) {
          /*eslint no-console:0*/
          window.console && console.error && console.error('Unregistered interface: ' + entry.type);
          return null;
        }
        return (
          <Component
            key={"entry-" + entryIdx}
            group={group}
            event={evt}
            type={entry.type}
            data={entry.data}
            isShare={isShare} />
        );
      } catch (ex) {
        logException(ex);
        return (
          <EventDataSection
              group={group}
              event={evt}
              type={entry.type}
              title={entry.type}>
            <p>There was an error rendering this data.</p>
          </EventDataSection>
        );
      }
    });

    return (
      <div>
        {!utils.objectIsEmpty(evt.errors) &&
          <EventErrors
            group={group}
            event={evt} />
        }
        <EventMessage
          group={group}
          event={evt} />
        <EventTags
          group={group}
          event={evt} />
        {!utils.objectIsEmpty(evt.user) &&
          <EventUser
            group={group}
            event={evt} />
        }
        {entries}
        {!utils.objectIsEmpty(evt.context) &&
          <EventExtraData
            group={group}
            event={evt} />
        }
        {!utils.objectIsEmpty(evt.packages) &&
          <EventPackageData
            group={group}
            event={evt} />
        }
      </div>
    );
  }
});

export default EventEntries;
