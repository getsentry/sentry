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
  chainedException: boolean;
  expandFirstFrame?: boolean;
  newestFirst?: boolean;
};

const ExceptionStacktraceContent = ({
  stackView,
  stacktrace,
  chainedException,
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
    stacktrace.frames.filter(frame => frame.inApp).length === 0 &&
    !chainedException
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

  /**
   * Armin, Markus:
   * If all frames are in app, then no frame is in app.
   * This normally does not matter for the UI but when chained exceptions
   * are used this causes weird behavior where one exception appears to not have a stacktrace.
   *
   * It is easier to fix the UI logic to show a non-empty stacktrace for chained exceptions
   */

  return (
    <StacktraceContent
      data={data}
      expandFirstFrame={expandFirstFrame}
      includeSystemFrames={
        stackView === 'full' ||
        (chainedException && stacktrace.frames.every(frame => !frame.inApp))
      }
      platform={platform}
      newestFirst={newestFirst}
      event={event}
    />
  );
};

export default ExceptionStacktraceContent;
