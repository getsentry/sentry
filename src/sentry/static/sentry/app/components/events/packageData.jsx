import React from 'react';
import PropTypes from '../../proptypes';

import EventDataSection from './eventDataSection';
import ClippedBox from '../clippedBox';

const EventPackageData = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render() {
    let packages = this.props.event.packages;
    let packageKeys = [];
    for (let key in packages) {
      packageKeys.push(key);
    }
    packageKeys.sort();

    let children = [];
    packageKeys.forEach((key) => {
      children.push(<tr key={'dt-' + key}><td>{key}</td><td><pre>{packages[key]}</pre></td></tr>);
    });

    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="packages"
          title="Packages">
        <ClippedBox>
          <table className="table key-value">
            <tbody>
            {children}
            </tbody>
          </table>
        </ClippedBox>
      </EventDataSection>
    );
  }
});

export default EventPackageData;
