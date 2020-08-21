import React from 'react';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Hovercard, {Body} from 'app/components/hovercard';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';

type Props = AsyncComponent['props'] & {
  issueId: string;
  api: Client;
};

type State = {
  event: Event | null;
};

class StacktracePreview extends React.Component<Props, State> {
  state: State = {
    event: null,
  };

  fetchData = async () => {
    if (this.state.event) {
      return;
    }

    const {api, issueId} = this.props;
    const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
    this.setState({event});
  };

  render() {
    const {event} = this.state;
    const exception = event?.entries.find(e => e.type === 'exception')?.data;

    return (
      <span onMouseEnter={this.fetchData}>
        <StyledHovercard
          body={
            event && exception ? (
              <StacktraceContent
                data={exception.values[0].stacktrace}
                includeSystemFrames={!exception.hasSystemFrames} // (chainedException && stacktrace.frames.every(frame => !frame.inApp))
                expandFirstFrame={false}
                platform={event.platform}
                newestFirst={isStacktraceNewestFirst()}
                event={event}
              />
            ) : null
          }
          header={event ? t('Stacktrace preview') : null}
          position="left"
        >
          {this.props.children}
        </StyledHovercard>
      </span>
    );
  }
}

const StyledHovercard = styled(Hovercard)`
  width: 700px;
  border: none;

  ${Body} {
    padding: 0;
    max-height: 300px;
    overflow: scroll;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }

  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }

  /* remove platform flag set in less file */
  .frame {
    &.javascript,
    &.objc,
    &.cocoa {
      &:before,
      &:after {
        content: none;
      }
    }
  }
`;

export default withApi(StacktracePreview);
