import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
//import GroupEventDataSection from "../eventDataSection";
import Frame from 'app/components/events/interfaces/frame';
import {t} from 'app/locale';
import OrganizationState from 'app/mixins/organizationState';

const StacktraceContent = createReactClass({
  displayName: 'StacktraceContent',

  propTypes: {
    data: PropTypes.object.isRequired,
    includeSystemFrames: PropTypes.bool,
    expandFirstFrame: PropTypes.bool,
    platform: PropTypes.string,
    newestFirst: PropTypes.bool,
  },

  mixins: [OrganizationState],

  getDefaultProps() {
    return {
      includeSystemFrames: true,
      expandFirstFrame: true,
    };
  },

  renderOmittedFrames(firstFrameOmitted, lastFrameOmitted) {
    const props = {
      className: 'frame frames-omitted',
      key: 'omitted',
    };
    const text = t(
      'Frames %d until %d were omitted and not available.',
      firstFrameOmitted,
      lastFrameOmitted
    );
    return <li {...props}>{text}</li>;
  },

  frameIsVisible(frame, nextFrame) {
    return (
      this.props.includeSystemFrames || frame.inApp || (nextFrame && nextFrame.inApp)
    );
  },

  render() {
    const data = this.props.data;
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

    const expandFirstFrame = this.props.expandFirstFrame;
    const frames = [];
    let nRepeats = 0;
    data.frames.forEach((frame, frameIdx) => {
      const prevFrame = data.frames[frameIdx - 1];
      const nextFrame = data.frames[frameIdx + 1];
      const repeatedFrame =
        nextFrame &&
        frame.lineNo === nextFrame.lineNo &&
        frame.instructionAddr === nextFrame.instructionAddr &&
        frame.package === nextFrame.package &&
        frame.module === nextFrame.module &&
        frame.function === nextFrame.function;

      if (repeatedFrame) {
        nRepeats++;
      }

      if (this.frameIsVisible(frame, nextFrame) && !repeatedFrame) {
        frames.push(
          <Frame
            key={frameIdx}
            data={frame}
            isExpanded={expandFirstFrame && lastFrameIdx === frameIdx}
            emptySourceNotation={lastFrameIdx === frameIdx && frameIdx === 0}
            isOnlyFrame={this.props.data.frames.length === 1}
            nextFrame={nextFrame}
            prevFrame={prevFrame}
            platform={this.props.platform}
            timesRepeated={nRepeats}
          />
        );
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIdx === firstFrameOmitted) {
        frames.push(this.renderOmittedFrames(firstFrameOmitted, lastFrameOmitted));
      }
    });

    if (frames.length > 0 && data.registers) {
      const lastFrame = frames.length - 1;
      frames[lastFrame] = React.cloneElement(frames[lastFrame], {
        registers: data.registers,
      });
    }

    if (this.props.newestFirst) {
      frames.reverse();
    }
    let className = this.props.className || '';
    className += ' traceback';

    if (this.props.includeSystemFrames) {
      className += ' full-traceback';
    } else {
      className += ' in-app-traceback';
    }

    return (
      <div className={className}>
        <ul>{frames}</ul>
      </div>
    );
  },
});

export default StacktraceContent;
