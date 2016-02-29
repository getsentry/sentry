import React from 'react';
import {defined} from '../../../utils';

import StacktraceContent from './stacktraceContent';

const ExceptionContent = React.createClass({
  propTypes: {
    values: React.PropTypes.array.isRequired,
    view: React.PropTypes.string.isRequired,
    platform: React.PropTypes.string,
    newestFirst: React.PropTypes.bool
  },

  render() {
    let stackView = this.props.view;
    let children = this.props.values.map((exc, excIdx) => {
      return (
        <div key={excIdx}>
          <h4>
            <span>{exc.type}</span>
          </h4>
          {exc.value &&
            <pre className="exc-message">{exc.value}</pre>
          }
          {defined(exc.stacktrace) &&
            <StacktraceContent
                data={exc.stacktrace}
                includeSystemFrames={stackView === 'full'}
                platform={this.props.platform}
                newestFirst={this.props.newestFirst} />
          }
        </div>
      );
    });
    if (this.props.newestFirst) {
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
