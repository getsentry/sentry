import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import {isStacktraceNewestFirst} from './stacktrace';
import CrashHeader from './crashHeader';
import CrashContent from './crashContent';

const ExceptionInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  getInitialState() {
    return {
      stackView: this.props.data.hasSystemFrames ? 'app' : 'full',
      newestFirst: isStacktraceNewestFirst(),
      stackType: 'original',
    };
  },

  eventHasThreads() {
    return !!this.props.event.entries.find(x => x.type === 'threads');
  },

  render() {
    let group = this.props.group;
    let event = this.props.event;
    let data = this.props.data;
    let stackView = this.state.stackView;
    let stackType = this.state.stackType;
    let newestFirst = this.state.newestFirst;

    // in case there are threads in the event data, we don't render the
    // exception block.  Instead the exception is contained within the
    // thread interface.
    if (this.eventHasThreads()) {
      return null;
    }

    let title = (
      <CrashHeader
        group={group}
        platform={event.platform}
        exception={data}
        stackView={stackView}
        newestFirst={newestFirst}
        stackType={stackType}
        onChange={(newState) => {
          this.setState(newState);
        }}
      />
    );

    return (
      <GroupEventDataSection
          group={group}
          event={event}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <CrashContent
          group={group}
          event={event}
          stackType={stackType}
          stackView={stackView}
          newestFirst={newestFirst}
          exception={data} />
      </GroupEventDataSection>
    );
  }
});

export default ExceptionInterface;
