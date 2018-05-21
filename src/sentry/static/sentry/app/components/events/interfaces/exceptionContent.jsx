import PropTypes from 'prop-types';
import React from 'react';
import {defined} from 'app/utils';

import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';

class ExceptionContent extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(['original', 'minified']),
    values: PropTypes.array.isRequired,
    view: PropTypes.string.isRequired,
    platform: PropTypes.string,
    newestFirst: PropTypes.bool,
    release: PropTypes.string,
    event: PropTypes.object,
  };

  render() {
    // console.log("this is the EVENTTTT and i'm in ExceptionContent");
    // console.log(this.props.event.errors[0].type)
    let stackView = this.props.view;
    let newestFirst = this.props.newestFirst;
    let children = this.props.values.map((exc, excIdx) => {
      return (
        <div key={excIdx} className="exception">
          <h5 className="break-word" style={{marginBottom: 5}}>
            <span>{exc.type}</span>
          </h5>
          {exc.value && (
            <pre className="exc-message" style={{marginTop: 0}}>
              {exc.value}
            </pre>
          )}
          {exc.mechanism && (
            <ExceptionMechanism data={exc.mechanism} platform={this.props.platform} />
          )}
          {defined(exc.stacktrace) && (
            <StacktraceContent
              data={
                this.props.type === 'original'
                  ? exc.stacktrace
                  : exc.rawStacktrace || exc.stacktrace
              }
              expandFirstFrame={excIdx === 0}
              includeSystemFrames={stackView === 'full'}
              platform={this.props.platform}
              newestFirst={newestFirst}
              release={this.props.release}
              errorType={this.props.event.errors[0].type}
            />
          )}
        </div>
      );
    });
    if (newestFirst) {
      children.reverse();
    }

    // TODO(dcramer): implement exceptions omitted
    return <div>{children}</div>;
  }
}

export default ExceptionContent;