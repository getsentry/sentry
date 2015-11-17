import React from 'react';
//import GroupEventDataSection from "../eventDataSection";
import Frame from './frame';

const StacktraceContent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    includeSystemFrames: React.PropTypes.bool,
    newestFirst: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      includeSystemFrames: true
    };
  },

  render() {
    let data = this.props.data;
    let firstFrameOmitted, lastFrameOmitted;
    let includeSystemFrames = this.props.includeSystemFrames;

    if (data.framesOmitted) {
      firstFrameOmitted = data.framesOmitted[0];
      lastFrameOmitted = data.framesOmitted[1];
    } else {
      firstFrameOmitted = null;
      lastFrameOmitted = null;
    }

    let frames = [];
    data.frames.forEach((frame, frameIdx) => {
      if (includeSystemFrames || frame.inApp) {
        frames.push(<Frame key={frameIdx} data={frame} />);
      }
      if (frameIdx === firstFrameOmitted) {
        frames.push((
          <li className="frame frames-omitted" key="omitted">
            Frames {firstFrameOmitted} until {lastFrameOmitted} were omitted and not available.
          </li>
        ));
      }
    });

    if (this.props.newestFirst) {
      frames.reverse();
    }

    return (
      <div className="traceback">
        <ul>
          {frames}
        </ul>
      </div>
    );
  }
});

export default StacktraceContent;
