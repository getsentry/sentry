import {debounce} from 'lodash';
import React, {unstable_Profiler as ReactProfiler} from 'react';
import * as Sentry from '@sentry/browser';

import {startRender, finishRender} from 'app/utils/apm';
import getDisplayName from 'app/utils/getDisplayName';

class Profiler {
  spansById = new Map([]);

  dispose() {
    this.spansById = new Map([]);
  }

  commit = debounce((id, span, timestamp) => {
    span.timestamp = timestamp;
    span.finishedSpans.push(span);
    Sentry.finishSpan(span);
    finishRender(id);
  }, 500);

  handleRender = (
    id,
    phase,
    actualDuration,
    _baseDuration,
    startTime,
    _commitTime,
    _interactions
  ) => {
    let span;
    const start = window.performance && window.performance.timing.navigationStart;

    console.log(_interactions);

    if (phase === 'mount') {
      startRender(id);
      span = Sentry.startSpan({
        data: {},
        op: 'react',
        description: `render <${id}>`,
      });

      if (!span) {
        return;
      }

      span.startTimestamp = (start + startTime) / 1000;
      this.commit(id, span, (start + startTime + actualDuration) / 1000);
      this.spansById.set(id, span);
    } else {
      span = this.spansById.get(id);

      if (span) {
        // yikes
        span.timestamp = (start + startTime + actualDuration) / 1000;
      }
    }
  };
}

export default function profiler() {
  return WrappedComponent => {
    return class extends React.Component {
      componentWillUnmount() {
        this.profiler.dispose();
        this.profiler = null;
      }

      profiler = new Profiler();

      render() {
        return (
          <ReactProfiler
            id={getDisplayName(WrappedComponent)}
            onRender={this.profiler.handleRender}
          >
            <WrappedComponent {...this.props} />
          </ReactProfiler>
        );
      }
    };
  };
}
