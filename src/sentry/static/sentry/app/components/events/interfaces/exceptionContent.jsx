import PropTypes from 'prop-types';
import React from 'react';

import {defined} from 'app/utils';
import Annotated from 'app/components/events/meta/annotated';
import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import SentryTypes from 'app/sentryTypes';

class ExceptionContent extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(['original', 'minified']),
    values: PropTypes.array.isRequired,
    view: PropTypes.string.isRequired,
    platform: PropTypes.string,
    newestFirst: PropTypes.bool,
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const {newestFirst, event, view: stackView, platform, values} = this.props;
    const children = values.map((exc, excIdx) => {
      return (
        <div key={excIdx} className="exception">
          <h5 className="break-word" style={{marginBottom: 5}}>
            <span>{exc.type}</span>
          </h5>

          <Annotated object={exc} prop="value" required>
            {value => (
              <pre className="exc-message" style={{marginTop: 0}}>
                {value}
              </pre>
            )}
          </Annotated>

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
              expandFirstFrame={
                platform === 'csharp' ? excIdx === values.length - 1 : excIdx === 0
              }
              includeSystemFrames={stackView === 'full'}
              platform={this.props.platform}
              newestFirst={newestFirst}
              event={event}
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
