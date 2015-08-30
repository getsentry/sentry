import React from "react";
import PropTypes from "../../proptypes";

import EventDataSection from "./eventDataSection";
import ClippedBox from "../clippedBox";

var EventPackageData = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render() {
    var packages = this.props.event.packages;
    var packageKeys = [];
    for (let key in packages) {
      packageKeys.push(key);
    }
    packageKeys.sort();

    var children = [];
    packageKeys.forEach((key) => {
      children.push(<dt key={'dt-' + key}>{key}</dt>);
      children.push(<dd key={'dd-' + key}><pre>{packages[key]}</pre></dd>);
    });

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="packages"
          title="Packages">
        <ClippedBox>
          <dl className="vars">
            {children}
          </dl>
        </ClippedBox>
      </EventDataSection>
    );
  }
});

export default EventPackageData;
