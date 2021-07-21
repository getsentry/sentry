import * as React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import StacktraceContentV2 from 'app/components/events/interfaces/stacktraceContentV2';
import Hovercard, {Body} from 'app/components/hovercard';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, PlatformType} from 'app/types';
import {EntryType, Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';
import {defined} from 'app/utils';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import findBestThread from './events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from './events/interfaces/threads/threadSelector/getThreadStacktrace';

const HOVERCARD_DELAY = 500;
export const STACKTRACE_PREVIEW_TOOLTIP_DELAY = 1000;

type Props = {
  issueId: string;
  organization: Organization;
  api: Client;
  theme: Theme;
  groupingCurrentLevel?: number;
  disablePreview?: boolean;
  eventId?: string;
  projectSlug?: string;
  className?: string;
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
    const {organization, api, issueId, eventId, projectSlug} = this.props;

    if (this.state.event || (!issueId && !(eventId && projectSlug))) {
      return;
    }

    this.loaderTimeout = window.setTimeout(() => {
      this.setState({loadingVisible: true});
    }, HOVERCARD_DELAY);

    try {
      const event = await api.requestPromise(
        eventId && projectSlug
          ? `/projects/${organization.slug}/${projectSlug}/events/${eventId}/`
          : `/issues/${issueId}/events/latest/`
      );
      clearTimeout(this.loaderTimeout);
      this.setState({event, loading: false, loadingVisible: false});
    } catch {
      clearTimeout(this.loaderTimeout);
      this.setState({loading: false, loadingVisible: false});
    }
  };

  handleStacktracePreviewClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  getStacktrace(): StacktraceType | undefined {
    const {event} = this.state;

    if (!event) {
      return undefined;
    }

    const exceptionsWithStacktrace =
      event.entries
        .find(e => e.type === EntryType.EXCEPTION)
        ?.data?.values.filter(({stacktrace}) => defined(stacktrace)) ?? [];

    const exceptionStacktrace: StacktraceType | undefined = isStacktraceNewestFirst()
      ? exceptionsWithStacktrace[exceptionsWithStacktrace.length - 1]?.stacktrace
      : exceptionsWithStacktrace[0]?.stacktrace;

    if (exceptionStacktrace) {
      return exceptionStacktrace;
    }

    const threads =
      event.entries.find(e => e.type === EntryType.THREADS)?.data?.values ?? [];
    const bestThread = findBestThread(threads);

    if (!bestThread) {
      return undefined;
    }

    const bestThreadStacktrace = getThreadStacktrace(false, bestThread);

    if (bestThreadStacktrace) {
      return bestThreadStacktrace;
    }

    return undefined;
  }

  renderHovercardBody(stacktrace: StacktraceType | undefined) {
    const {event, loading, loadingVisible} = this.state;

    if (loading && loadingVisible) {
      return (
        <NoStackTraceWrapper>
          <LoadingIndicator hideMessage size={32} />
        </NoStackTraceWrapper>
      );
    }

    if (loading) {
      return null;
    }

    if (!stacktrace) {
      return (
        <NoStackTraceWrapper onClick={this.handleStacktracePreviewClick}>
          {t("There's no stack trace available for this issue.")}
        </NoStackTraceWrapper>
      );
    }

    const {organization, groupingCurrentLevel} = this.props;

    if (event) {
      const platform = (event.platform ?? 'other') as PlatformType;

      return (
        <div onClick={this.handleStacktracePreviewClick}>
          {!!organization.features?.includes('grouping-tree-ui') ? (
            <StacktraceContentV2
              data={stacktrace}
              expandFirstFrame={false}
              includeSystemFrames={(stacktrace.frames ?? []).every(frame => !frame.inApp)}
              platform={platform}
              newestFirst={isStacktraceNewestFirst()}
              event={event}
              groupingCurrentLevel={groupingCurrentLevel}
              isHoverPreviewed
            />
          ) : (
            <StacktraceContent
              data={stacktrace}
              expandFirstFrame={false}
              includeSystemFrames={(stacktrace.frames ?? []).every(frame => !frame.inApp)}
              platform={platform}
              newestFirst={isStacktraceNewestFirst()}
              event={event}
              isHoverPreviewed
            />
          )}
        </div>
      );
    }

    return null;
  }

  render() {
    const {children, disablePreview, theme, className} = this.props;

    const {loading, loadingVisible} = this.state;
    const stacktrace = this.getStacktrace();

    if (disablePreview) {
      return children;
    }

    return (
      <span className={className} onMouseEnter={this.fetchData}>
        <StyledHovercard
          body={this.renderHovercardBody(stacktrace)}
          position="right"
          modifiers={{
            flip: {
              enabled: false,
            },
            preventOverflow: {
              padding: 20,
              enabled: true,
              boundariesElement: 'viewport',
            },
          }}
          state={loading && loadingVisible ? 'loading' : !stacktrace ? 'empty' : 'done'}
          tipBorderColor={theme.border}
          tipColor={theme.background}
        >
          {children}
        </StyledHovercard>
      </span>
    );
  }
}

const StyledHovercard = styled(Hovercard)<{state: 'loading' | 'empty' | 'done'}>`
  /* Lower z-index to match the modals (10000 vs 10002) to allow stackTraceLinkModal be on top of stack trace preview. */
  z-index: ${p => p.theme.zIndex.modal};
  width: ${p => {
    if (p.state === 'loading') {
      return 'auto';
    }
    if (p.state === 'empty') {
      return '340px';
    }
    return '700px';
  }};

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

  .loading {
    margin: 0 auto;
    .loading-indicator {
      /**
      * Overriding the .less file - for default 64px loader we have the width of border set to 6px
      * For 32px we therefore need 3px to keep the same thickness ratio
      */
      border-width: 3px;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

const NoStackTraceWrapper = styled('div')`
  color: ${p => p.theme.subText};
  padding: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
`;

export default withApi(withTheme(StacktracePreview));
