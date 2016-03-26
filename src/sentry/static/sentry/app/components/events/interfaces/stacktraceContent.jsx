import React from 'react';
//import GroupEventDataSection from "../eventDataSection";
import Frame from './frame';
import {t} from '../../../locale';

const StacktraceContent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    includeSystemFrames: React.PropTypes.bool,
    platform: React.PropTypes.string,
    newestFirst: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      includeSystemFrames: true
    };
  },

  shouldRenderAsTable() {
    return this.props.platform === 'cocoa';
  },

  renderOmittedFrames(firstFrameOmitted, lastFrameOmitted) {
    let props = {
      className: 'frame frames-omitted',
      key: 'omitted'
    };
    let text = t('Frames %d until %d were omitted and not available.',
                 firstFrameOmitted, lastFrameOmitted);
    return <li {...props}>{text}</li>;
  },

  frameIsVisible(frame, nextFrame) {
    return (
      this.props.includeSystemFrames ||
      frame.inApp ||
      (nextFrame && nextFrame.inApp)
    );
  },

  render() {
    let data = this.props.data;
    let firstFrameOmitted, lastFrameOmitted;

    if (data.framesOmitted) {
      firstFrameOmitted = data.framesOmitted[0];
      lastFrameOmitted = data.framesOmitted[1];
    } else {
      firstFrameOmitted = null;
      lastFrameOmitted = null;
    }

    let frames = [];
    data.frames.forEach((frame, frameIdx) => {
      let nextFrame = data.frames[frameIdx + 1];
      if (this.frameIsVisible(frame, nextFrame)) {
        frames.push(
          <Frame
            key={frameIdx}
            data={frame}
            nextFrameInApp={nextFrame && nextFrame.inApp}
            platform={this.props.platform} />
        );
      }
      if (frameIdx === firstFrameOmitted) {
        frames.push(this.renderOmittedFrames(
          firstFrameOmitted, lastFrameOmitted));
      }
    });

    if (this.props.newestFirst) {
      frames.reverse();
    }

    return (
      <div className="traceback">
        <ul>{frames}</ul>
      </div>
    );
  }
});

export default StacktraceContent;
