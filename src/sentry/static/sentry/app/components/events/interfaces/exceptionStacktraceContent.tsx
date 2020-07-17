import React from 'react';

import {defined} from 'app/utils';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import {Panel} from 'app/components/panels';
import {IconWarning} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SentryTypes from 'app/sentryTypes';
import {Stacktrace, StackViewType} from 'app/types/stacktrace';
import {PlatformType} from 'app/types';

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
          icon={<IconWarning size="xs" />}
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
