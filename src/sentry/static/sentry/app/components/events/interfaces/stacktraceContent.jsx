import React from 'react';
//import GroupEventDataSection from "../eventDataSection";
import Frame from './frame';
import {t} from '../../../locale';
import OrganizationState from '../../../mixins/organizationState';


const StacktraceContent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    includeSystemFrames: React.PropTypes.bool,
    platform: React.PropTypes.string,
    newestFirst: React.PropTypes.bool
  },
  mixins: [OrganizationState],

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

    let lastFrameIdx = null;
    data.frames.forEach((frame, frameIdx) => {
      if (frame.inApp) lastFrameIdx = frameIdx;
    });
    if (lastFrameIdx === null) {
      lastFrameIdx = data.frames.length - 1;
    }

    // use old frames if we do not have an org (share view) or
    // we don't have the feature
    let FrameComponent = Frame;
    let frames = [];
    data.frames.forEach((frame, frameIdx) => {
      let nextFrame = data.frames[frameIdx + 1];
      if (this.frameIsVisible(frame, nextFrame)) {
        frames.push(
          <FrameComponent
            key={frameIdx}
            data={frame}
            isExpanded={lastFrameIdx === frameIdx}
            emptySourceNotation={lastFrameIdx === frameIdx && frameIdx === 0}
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

    let className = this.props.className || '';
    className += ' traceback';

    return (
      <div className={className}>
        <ul>{frames}</ul>
      </div>
    );
  }
});

export default StacktraceContent;
