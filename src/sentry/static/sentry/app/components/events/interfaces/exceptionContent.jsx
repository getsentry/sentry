import React from 'react';
import {defined} from '../../../utils';

import StacktraceContent from './stacktraceContent';
import ExceptionMechanism from './exceptionMechanism';

const ExceptionContent = React.createClass({
  propTypes: {
    type: React.PropTypes.oneOf(['original', 'minified']),
    values: React.PropTypes.array.isRequired,
    view: React.PropTypes.string.isRequired,
    platform: React.PropTypes.string,
    newestFirst: React.PropTypes.bool
  },

  render() {
    let stackView = this.props.view;
    let newestFirst = this.props.newestFirst;
    let children = this.props.values.map((exc, excIdx) => {
      return (
        <div key={excIdx} className="exception">
          <h5 className="break-word" style={{marginBottom: 5}}>
            <span>{exc.type}</span>
          </h5>
          {exc.value &&
            <pre className="exc-message" style={{marginTop: 0}}>{exc.value}</pre>
          }
          {exc.mechanism &&
            <ExceptionMechanism
              data={exc.mechanism}
              platform={this.props.platform}/>
          }
          {defined(exc.stacktrace) &&
            <StacktraceContent
                data={this.props.type === 'original'
                  ? exc.stacktrace
                  : (exc.rawStacktrace || exc.stacktrace)}
                expandFirstFrame={excIdx === 0}
                includeSystemFrames={stackView === 'full'}
                platform={this.props.platform}
                newestFirst={newestFirst} />
          }
        </div>
      );
    });
    if (newestFirst) {
      children.reverse();
    }

    // TODO(dcramer): implement exceptions omitted
    return (
      <div>
        {children}
      </div>
    );
  }
});

export default ExceptionContent;
