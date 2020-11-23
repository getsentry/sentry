import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';

import {Client} from 'app/api';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import Hovercard, {Body} from 'app/components/hovercard';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event, Organization, PlatformType} from 'app/types';
import {StacktraceType} from 'app/types/stacktrace';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

type Props = {
  issueId: string;
  organization: Organization;
  api: Client;
  theme: Theme;
};

type State = {
  loading: boolean;
  event?: Event;
};

class StacktracePreview extends React.Component<Props, State> {
  state: State = {
    loading: true,
  };

  fetchData = async () => {
    if (this.state.event) {
      return;
    }

    const {api, issueId} = this.props;
    try {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      this.setState({event, loading: false});
    } catch {
      // preview will not show up
    }
  };

  handleStacktracePreviewClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  renderHovercardBody(stacktrace: StacktraceType) {
    const {event, loading} = this.state;

    if (loading) {
      return null;
    }

    if (!stacktrace) {
      return (
        <NoStacktraceMessage onClick={this.handleStacktracePreviewClick}>
          {t('There is no stack trace.')}
        </NoStacktraceMessage>
      );
    }

    if (event) {
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
            hideStacktraceLink
          />
        </div>
      );
    }

    return null;
  }

  render() {
    const {children, organization, theme} = this.props;
    const {stacktrace} =
      this.state.event?.entries.find(e => e.type === 'exception')?.data?.values[0] ?? {};

    if (!organization.features.includes('stacktrace-hover-preview')) {
      return children;
    }

    return (
      <span onMouseEnter={this.fetchData}>
        <StyledHovercard
          body={this.renderHovercardBody(stacktrace)}
          hasStacktrace={!!stacktrace}
          position="right"
          tipColor={theme.background}
        >
          {children}
        </StyledHovercard>
      </span>
    );
  }
}

const StyledHovercard = styled(Hovercard)<{hasStacktrace: boolean}>`
  width: ${p => (p.hasStacktrace ? '700px' : 'auto')};
  border-color: ${p => p.theme.background};

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

const NoStacktraceMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray400};
  padding: ${space(1.5)};
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 250px;
  min-height: 50px;
`;

export default withTheme(withApi(StacktracePreview));
