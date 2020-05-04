import React from 'react';

import {PlatformType} from 'app/components/events/interfaces/frame/types';
import {defined} from 'app/utils';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import {Panel} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SentryTypes from 'app/sentryTypes';
import {Stacktrace, StackViewType} from 'app/types/stacktrace';

type Props = {
  stackView: StackViewType;
  data: Stacktrace | null;
  event: SentryTypes.Event;
  platform: PlatformType;
  stacktrace: Stacktrace;
  expandFirstFrame?: boolean;
  newestFirst?: boolean;
};

const ExceptionStacktraceContent = ({
  stackView,
  stacktrace,
  platform,
  newestFirst,
  data,
  expandFirstFrame,
  event,
}: Props) => {
  if (!defined(stacktrace)) {
    return null;
  }

  if (
    stackView === 'app' &&
    stacktrace.frames.filter(frame => frame.inApp).length === 0
  ) {
    return (
      <Panel dashedBorder>
        <EmptyMessage
          icon="icon-warning-sm"
          title="No app only stacktrace has been found!"
        />
      </Panel>
    );
  }

  return (
    <StacktraceContent
      data={data}
      expandFirstFrame={expandFirstFrame}
      includeSystemFrames={stackView === 'full'}
      platform={platform}
      newestFirst={newestFirst}
      event={event}
    />
  );
};

export default ExceptionStacktraceContent;
