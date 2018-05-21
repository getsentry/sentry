import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
//import GroupEventDataSection from "../eventDataSection";

import Frame from 'app/components/events/interfaces/frame';
import {t} from 'app/locale';
import OrganizationState from 'app/mixins/organizationState';
import ProjectState from 'app/mixins/projectState';
import ApiMixin from 'app/mixins/apiMixin';


const StacktraceContent = createReactClass({
  displayName: 'StacktraceContent',

  propTypes: {
    data: PropTypes.object.isRequired,
    includeSystemFrames: PropTypes.bool,
    expandFirstFrame: PropTypes.bool,
    platform: PropTypes.string,
    newestFirst: PropTypes.bool,
    release: PropTypes.string,
    errorType: PropTypes.string,
  },

  mixins: [ApiMixin, ProjectState],

  getDefaultProps() {
    return {
      includeSystemFrames: true,
      expandFirstFrame: true,
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  renderOmittedFrames(firstFrameOmitted, lastFrameOmitted) {
    let props = {
      className: 'frame frames-omitted',
      key: 'omitted',
    };
    let text = t(
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

  getFilesEndpoint() {
    let params = this.context;
    let release = this.props.release;
    return `/projects/${params.organization.slug}/${params.project
      .slug}/releases/${encodeURIComponent(release)}/files/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(this.getFilesEndpoint(), {
      method: 'GET',
      data: {}, // dis line not working
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          fileList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  compareFiles(fileList, stackTraceData) {
    // compare the file list against the stack trace content
    // figure out how to send this to the error banner rather than console.logging
    let fileListSize = Object.keys(fileList).length;
    let stackTraceDataSize = Object.keys(stackTraceData.frames).length;

    // no files at all, fail fast
    if (fileListSize === 0 && stackTraceDataSize === 0) {
      console.log("We don't have any of your files! Upload em");
    } else {
      let fileListFile = fileList.find(
        file => file.name.endsWith('.js') || file.name.endsWith('.min.js')
      ).name;
      let stackTraceFile = stackTraceData.frames.find(
        file =>
          typeof file.map !== 'undefined' &&
          file.map.startsWith('raven') !== true &&
          file.map.endsWith('.map')
      ).map;

      // we have either the map OR the min, figure out which and message appropriately
      if (typeof stackTraceFile === 'undefined') {
        if (stackTraceFile.endsWith('.map')) {
          console.log('We only have your map file. You need to upload the min');
        } else {
          console.log('We only have your min file. You need to upload the map');
        }
      } else {
        // strip the file path from one file and compare
        let file = fileListFile.replace(/^.*[\\\/]/, '');
        if (stackTraceFile.indexOf(file) >= 0) {
          console.log('They match!');
        } else {
          console.log('They do not match');
        }
      }
    }
  },

  render() {
    let files = this.state.fileList;
    let data = this.props.data;
    let errorType = this.props.errorType;

    // probably going to add other error types in later
    if (errorType === 'fetch_invalid_http_code' && Object.keys(files).length > 0) {
      this.compareFiles(files, data);
    }

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

    let expandFirstFrame = this.props.expandFirstFrame;
    let frames = [];
    let nRepeats = 0;
    data.frames.forEach((frame, frameIdx) => {
      let prevFrame = data.frames[frameIdx - 1];
      let nextFrame = data.frames[frameIdx + 1];
      let repeatedFrame =
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