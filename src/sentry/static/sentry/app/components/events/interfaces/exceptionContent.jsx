import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Annotated from 'app/components/events/meta/annotated';
import ExceptionMechanism from 'app/components/events/interfaces/exceptionMechanism';
import SentryTypes from 'app/sentryTypes';

import ExceptionStacktraceContent from './exceptionStacktraceContent';

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
    const {newestFirst, event, view: stackView, values} = this.props;
    if (newestFirst) {
      values.reverse();
    }

    const children = values.map((exc, excIdx) => (
      <div key={excIdx} className="exception">
        <h5 className="break-word" style={{marginBottom: 5}}>
          <span>{exc.type}</span>
        </h5>

        <Annotated object={exc} objectKey="value" required>
          {value => <StyledPre className="exc-message">{value}</StyledPre>}
        </Annotated>

        {exc.mechanism && (
          <ExceptionMechanism data={exc.mechanism} platform={this.props.platform} />
        )}
        <ExceptionStacktraceContent
          data={
            this.props.type === 'original'
              ? exc.stacktrace
              : exc.rawStacktrace || exc.stacktrace
          }
          stackView={stackView}
          stacktrace={exc.stacktrace}
          expandFirstFrame={excIdx === 0}
          platform={this.props.platform}
          newestFirst={newestFirst}
          event={event}
        />
      </div>
    ));

    // TODO(dcramer): implement exceptions omitted
    return <div>{children}</div>;
  }
}

export default ExceptionContent;

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;
