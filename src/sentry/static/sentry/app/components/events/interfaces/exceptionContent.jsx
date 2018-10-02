import PropTypes from 'prop-types';
import React from 'react';
import {defined} from 'app/utils';

import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';
import DataGroup from 'app/components/events/meta/dataGroup';
import DataText from 'app/components/events/meta/dataText';

class ExceptionContent extends React.Component {
  static propTypes = {
    type: PropTypes.oneOf(['original', 'minified']),
    view: PropTypes.string.isRequired,
    platform: PropTypes.string,
    newestFirst: PropTypes.bool,
  };

  render() {
    let stackView = this.props.view;
    let newestFirst = this.props.newestFirst;

    // TODO(dcramer): implement exceptions omitted
    return (
      <DataGroup get="values">
        {(values, valuesMeta) => {
          let children = values.map((exc, excIdx) => {
            return (
              <DataGroup key={excIdx} get={excIdx}>
                <div key={excIdx} className="exception">
                  <h5 className="break-word" style={{marginBottom: 5}}>
                    <span>{exc.type}</span>
                  </h5>

                  <pre className="exc-message" style={{marginTop: 0}}>
                    <DataText get="value" required />
                  </pre>

                  {exc.mechanism && (
                    <ExceptionMechanism
                      data={exc.mechanism}
                      platform={this.props.platform}
                    />
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
                    />
                  )}
                </div>
              </DataGroup>
            );
          });
          if (newestFirst) {
            children.reverse();
          }

          return children;
        }}
      </DataGroup>
    );
  }
}

export default ExceptionContent;
