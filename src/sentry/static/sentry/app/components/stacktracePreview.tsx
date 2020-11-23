import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import Hovercard, {Body} from 'app/components/hovercard';
import {Event, Organization, PlatformType} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  issueId: string;
  organization: Organization;
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
    try {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      this.setState({event});
    } catch {
      // preview will not show up
    }
  };

  handleStacktracePreviewClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  render() {
    const {organization, children} = this.props;
    const {event} = this.state;
    const exception = event?.entries.find(e => e.type === 'exception')?.data;
    const stacktrace = exception?.values[0]?.stacktrace;

    if (!organization.features.includes('stacktrace-hover-preview')) {
      return children;
    }

    return (
      <span onMouseEnter={this.fetchData}>
        <StyledHovercard
          body={
            event && exception && stacktrace ? (
              <div onClick={this.handleStacktracePreviewClick}>
                <StacktraceContent
                  data={stacktrace}
                  expandFirstFrame
                  // includeSystemFrames={!exception.hasSystemFrames} // (chainedException && stacktrace.frames.every(frame => !frame.inApp))
                  includeSystemFrames={stacktrace.frames.every(frame => !frame.inApp)}
                  platform={(event.platform ?? 'other') as PlatformType}
                  newestFirst={isStacktraceNewestFirst()}
                  event={event}
                />
              </div>
            ) : null
          }
          position="left"
        >
          {children}
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
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }

  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

export default withApi(StacktracePreview);
