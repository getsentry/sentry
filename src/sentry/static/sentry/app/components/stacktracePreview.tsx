import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import Hovercard, {Body} from 'app/components/hovercard';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';

type Props = {
  issueId: string;
  organization: Organization;
  api: Client;
  disablePreview?: boolean;
};

type State = {
  loading: boolean;
  loadingVisible: boolean;
  event?: Event;
};

class StacktracePreview extends React.Component<Props, State> {
  state: State = {
    loading: true,
    loadingVisible: false,
  };

  loaderTimeout: number | null = null;

  fetchData = async () => {
    if (this.state.event) {
      return;
    }

    this.loaderTimeout = window.setTimeout(() => {
      this.setState({loadingVisible: true});
    }, 1500);

    const {api, issueId} = this.props;
    try {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      clearTimeout(this.loaderTimeout);
      this.setState({event, loading: false, loadingVisible: false});
    } catch {
      clearTimeout(this.loaderTimeout);
      this.setState({loading: false, loadingVisible: false});
    }
  };

  handleStacktracePreviewClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  renderHovercardBody(stacktrace: StacktraceType) {
    const {event, loading, loadingVisible} = this.state;

    if (loading && loadingVisible) {
      return (
        <NoStackTraceWrapper>
          <LoadingIndicator hideMessage />
        </NoStackTraceWrapper>
      );
    }

    if (loading) {
      return null;
    }

    if (!stacktrace) {
      return (
        <NoStackTraceWrapper onClick={this.handleStacktracePreviewClick}>
          {t('There is no stack trace available for this issue.')}
        </NoStackTraceWrapper>
      );
    }

    if (event) {
      trackAnalyticsEvent({
        eventKey: 'stacktrace.preview.open',
        eventName: 'Stack Trace Preview: Open',
        organization_id: parseInt(this.props.organization.id, 10),
        issue_id: this.props.issueId,
      });

      return (
        <div onClick={this.handleStacktracePreviewClick}>
          <StacktraceContent
            data={stacktrace}
            expandFirstFrame={false}
            // includeSystemFrames={!exception.hasSystemFrames} // (chainedException && stacktrace.frames.every(frame => !frame.inApp))
            includeSystemFrames={stacktrace.frames.every(frame => !frame.inApp)}
            platform={(event.platform ?? 'other') as PlatformType}
            newestFirst={isStacktraceNewestFirst()}
            event={event}
            isHoverPreviewed
          />
        </div>
      );
    }

    return null;
  }

  render() {
    const {children, organization, disablePreview} = this.props;
    const {stacktrace} =
      this.state.event?.entries.find(e => e.type === 'exception')?.data?.values[0] ?? {};

    if (!organization.features.includes('stacktrace-hover-preview') || disablePreview) {
      return children;
    }

    return (
      <span onMouseEnter={this.fetchData}>
        <StyledHovercard body={this.renderHovercardBody(stacktrace)} position="right">
          {children}
        </StyledHovercard>
      </span>
    );
  }
}

const StyledHovercard = styled(Hovercard)`
  width: 700px;

  ${Body} {
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
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

const NoStackTraceWrapper = styled('div')`
  color: ${p => p.theme.gray400};
  padding: ${space(1.5)};
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
`;

export default withApi(StacktracePreview);
